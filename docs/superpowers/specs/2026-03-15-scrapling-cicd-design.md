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

**Note on `workflow_dispatch`:** The manual trigger always runs all three jobs regardless of which files changed. It always deploys `HEAD` of `main` — it cannot target a prior commit directly. To deploy a previous version, use the rollback procedure below.

---

## Components

### 1. `apps/scraper/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- `python:3.11-slim` for small image size
- `requirements.txt` copied and installed before `COPY . .` so the pip layer is cached across code-only changes
- `uvicorn` starts the FastAPI app on port 8000

### 2. `.github/workflows/scraper-ci.yml`

**Triggers:** `pull_request` when any file under `apps/scraper/**` changes

**Job: `test`**

1. `actions/checkout@v4`
2. `actions/setup-python@v5` (Python 3.11, pip cache keyed on `apps/scraper/requirements.txt`)
3. `pip install -r apps/scraper/requirements.txt`
4. `cd apps/scraper && pytest tests/ -v`

### 3. `.github/workflows/scraper-deploy.yml`

**Triggers:**

- `push` to `main` with path filter `apps/scraper/**`
- `workflow_dispatch` (manual, no inputs required — always deploys HEAD of main)

**Concurrency:** cancel in-progress runs on the same branch to prevent out-of-order deploys:

```yaml
concurrency:
  group: scraper-deploy-${{ github.ref }}
  cancel-in-progress: true
```

**Permissions** (workflow level — limits `GITHUB_TOKEN` scope):

```yaml
permissions:
  contents: read
  packages: write
```

**Job 1: `test`** — same steps as `scraper-ci.yml`

**Job 2: `build-push`** (`needs: test`)

1. `docker/login-action` → GHCR using `GITHUB_TOKEN` (the `packages: write` permission above is sufficient; no extra PAT needed)
2. `docker/metadata-action` with `images: ghcr.io/${{ github.repository_owner }}/flash-scraper` → generates tags:
   - `ghcr.io/<owner>/flash-scraper:latest`
   - `ghcr.io/<owner>/flash-scraper:sha-${{ github.sha }}`
3. `docker/build-push-action` with:
   - `context: apps/scraper`
   - `file: apps/scraper/Dockerfile`
   - `push: true`
   - `tags:` from metadata-action
   - `cache-from: type=gha` and `cache-to: type=gha,mode=max` (GitHub Actions cache — speeds up repeat builds)

**Job 3: `deploy`** (`needs: build-push`)

1. SSH into VPS using `appleboy/ssh-action` with host/username/key from secrets, port hardcoded to `22` (override with `VPS_PORT` secret if needed)
2. Remote commands — `docker pull` or `docker run` failure stops the sequence and leaves the old container running; `stop` and `rm` use `|| true` so the script is safe on first run when no container exists yet:
   ```bash
   docker pull ghcr.io/<owner>/flash-scraper:latest && \
   docker stop scraper || true && \
   docker rm scraper || true && \
   docker run -d \
     --name scraper \
     --restart unless-stopped \
     --env-file /opt/scraper/.env \
     -p 8000:8000 \
     ghcr.io/<owner>/flash-scraper:latest
   ```

---

## Secrets & Permissions

### GitHub Secrets (repo Settings → Secrets and Variables → Actions)

| Secret        | Value                                                     |
| ------------- | --------------------------------------------------------- |
| `VPS_HOST`    | IP address or hostname of VPS                             |
| `VPS_USER`    | SSH username (e.g. `ubuntu`, `root`)                      |
| `VPS_SSH_KEY` | Private SSH key content (ed25519 recommended)             |
| `VPS_PORT`    | SSH port — optional, workflow defaults to `22` if not set |

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

Prerequisites (not automated by CI — run these once before the first deploy):

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # allow non-root docker; log out and back in

# 2. Create env file
sudo mkdir -p /opt/scraper
sudo nano /opt/scraper/.env     # paste the env vars above, save

# 3. Authenticate with GHCR (only needed if the GitHub repo is private)
#    Create a classic PAT at github.com/settings/tokens with read:packages scope
docker login ghcr.io -u <github-username> -p <PAT>
#    This writes credentials to ~/.docker/config.json which persists across reboots
#    For a public repo, this step is not required — unauthenticated pulls work
```

**Note on image visibility:** On first push, GHCR defaults to private visibility. To make the image public (so VPS can pull without login), go to the package settings in GitHub → Packages and change visibility to Public. Otherwise, ensure step 3 above is completed on the VPS.

---

## Error Handling

| Failure                                   | Behaviour                                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pytest` fails                            | Workflow stops; no image built; no deploy                                                                |
| `docker build` fails                      | No deploy; previous `:latest` image on GHCR unchanged; VPS keeps running old container                   |
| SSH unreachable                           | Deploy job fails; old container keeps running; GitHub Actions surfaces the error                         |
| `docker pull` fails on VPS                | `&&` chain stops; `stop`/`rm` not reached; old container still running                                   |
| `docker run` fails on VPS                 | Container stopped/removed but new one failed to start — brief downtime. Operator must SSH in to diagnose |
| Two deploys triggered in quick succession | `concurrency: cancel-in-progress: true` cancels the earlier run; only the latest deploy completes        |
| VPS reboot                                | `--restart unless-stopped` auto-restarts the container                                                   |

**Rollback procedure:**

The deploy workflow pushes two tags per build: `:latest` and `:sha-<FULL_SHA>`. To roll back, SSH into the VPS and run:

```bash
# First stop the running container (|| true is safe if it's already stopped/absent)
docker stop scraper || true && docker rm scraper || true

# Start the previous version by SHA
docker run -d --name scraper --restart unless-stopped \
  --env-file /opt/scraper/.env -p 8000:8000 \
  ghcr.io/<owner>/flash-scraper:sha-<previous-full-sha>
```

The previous SHA can be found in the GitHub Actions run history or via `git log --oneline` on the repo.

---

## Out of Scope

- Zero-downtime blue/green or rolling deploys (background service, brief restart acceptable)
- Health-check gate before marking deploy successful (post-MVP)
- Multi-environment staging/prod separation
- Automated VPS provisioning (Terraform, Ansible)
