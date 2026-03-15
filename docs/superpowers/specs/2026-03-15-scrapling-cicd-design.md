# Scrapling Service CI/CD — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** GitHub Actions CI + CD pipeline for `apps/scraper/` Python FastAPI service, deploying to a user-managed VPS via Docker

---

## Overview

Add automated testing and deployment for the Python Scrapling microservice introduced in the `feature/scrapling-datasource` branch. Two GitHub Actions workflows handle CI (test on PR) and CD (build image → push to GHCR → SSH deploy on merge to `main` or manual trigger). The VPS runs the container directly via Docker with a local `.env` file for secrets.

---

## Architecture

```
PR touches apps/scraper/**
  → scraper-ci.yml: pytest (blocking)

Merge to main (apps/scraper/** changed) OR workflow_dispatch
  → scraper-deploy.yml:
      job 1: test (pytest)          ← blocks jobs 2 & 3
      job 2: build-push             ← docker build + push to GHCR
      job 3: deploy                 ← SSH → docker pull → restart container
```

---

## Components

### 1. `apps/scraper/Dockerfile`

```
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- `python:3.11-slim` for small image size
- Dependencies installed before copying source so layer is cached across code-only changes
- `uvicorn` starts the FastAPI app on port 8000

### 2. `.github/workflows/scraper-ci.yml`

**Triggers:** `pull_request` when any file under `apps/scraper/**` changes

**Job: `test`**

1. `actions/checkout@v4`
2. `actions/setup-python@v5` (Python 3.11, pip cache keyed on `requirements.txt`)
3. `pip install -r apps/scraper/requirements.txt`
4. `cd apps/scraper && pytest tests/ -v`

### 3. `.github/workflows/scraper-deploy.yml`

**Triggers:**

- `push` to `main` with path filter `apps/scraper/**`
- `workflow_dispatch` (manual, no inputs required)

**Job 1: `test`** — same steps as `scraper-ci.yml`

**Job 2: `build-push`** (`needs: test`)

1. `docker/login-action` → GHCR using `GITHUB_TOKEN` (no extra PAT needed with `packages: write` permission)
2. `docker/metadata-action` → generates tags:
   - `ghcr.io/<owner>/flash/scraper:latest`
   - `ghcr.io/<owner>/flash/scraper:sha-${{ github.sha }}`
3. `docker/build-push-action` → builds `apps/scraper/Dockerfile`, pushes both tags

**Job 3: `deploy`** (`needs: build-push`)

1. SSH into VPS using `appleboy/ssh-action`
2. Remote commands:
   ```bash
   docker pull ghcr.io/<owner>/flash/scraper:latest
   docker stop scraper || true
   docker rm scraper || true
   docker run -d \
     --name scraper \
     --restart unless-stopped \
     --env-file /opt/scraper/.env \
     -p 8000:8000 \
     ghcr.io/<owner>/flash/scraper:latest
   ```

---

## Secrets & Permissions

### GitHub Actions permissions

`scraper-deploy.yml` needs `permissions: packages: write` to push to GHCR using `GITHUB_TOKEN`. No extra PAT required.

### GitHub Secrets (repo Settings → Secrets and Variables → Actions)

| Secret        | Value                                 |
| ------------- | ------------------------------------- |
| `VPS_HOST`    | IP address or hostname of VPS         |
| `VPS_USER`    | SSH username (e.g. `ubuntu`, `root`)  |
| `VPS_SSH_KEY` | Private SSH key (ed25519 recommended) |
| `VPS_PORT`    | SSH port (default `22`, optional)     |

### VPS `/opt/scraper/.env`

Created manually once on the VPS. Never stored in GitHub:

```
NODE_API_URL=https://your-api-domain.com
INTERNAL_API_KEY=<shared-secret>
SCRAPE_INTERVAL_MINUTES=15
SCRAPE_TIMEOUT_SECONDS=30
```

---

## VPS One-Time Setup

Documented as prerequisites (not automated by CI):

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # allow non-root docker

# Create env file
sudo mkdir -p /opt/scraper
sudo nano /opt/scraper/.env     # paste env vars

# Allow GHCR image pulls (public repo = no auth needed; private = login once)
# docker login ghcr.io -u <github-username> -p <PAT with read:packages>
```

---

## Error Handling

| Failure                    | Behaviour                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pytest` fails             | Workflow stops; no image built; no deploy                                                                |
| `docker build` fails       | No deploy; previous `:latest` image on GHCR unchanged; VPS keeps running old container                   |
| SSH unreachable            | Deploy job fails; old container keeps running; GitHub Actions surfaces the error                         |
| `docker pull` fails on VPS | `stop`/`rm` not reached; old container still running                                                     |
| `docker run` fails on VPS  | Container stopped/removed but new one failed to start — brief downtime. Operator must SSH in to diagnose |
| VPS reboot                 | `--restart unless-stopped` auto-restarts the container                                                   |

**Rollback procedure:** SSH into VPS and run:

```bash
docker run -d --name scraper --restart unless-stopped \
  --env-file /opt/scraper/.env -p 8000:8000 \
  ghcr.io/<owner>/flash/scraper:sha-<previous-sha>
```

Or re-run the deploy workflow via `workflow_dispatch` — pointing it at the desired commit by checking out an older SHA is possible but requires a manual workaround; the SHA-tagged images on GHCR are the rollback mechanism.

---

## Out of Scope

- Zero-downtime blue/green or rolling deploys (background service, brief restart acceptable)
- Health-check gate before marking deploy successful (post-MVP)
- Multi-environment staging/prod separation
- Automated VPS provisioning (Terraform, Ansible)
