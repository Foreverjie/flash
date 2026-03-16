# Scrapling CI/CD Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dockerfile, CI workflow (pytest on PRs), and CD workflow (build → push to GHCR → SSH deploy to VPS) for the Python `apps/scraper/` service.

**Architecture:** All work goes on the existing `feature/scrapling-datasource` branch in worktree `.worktrees/scrapling-datasource`. The Dockerfile copies source as a `scraper/` subdirectory so internal `from scraper.xxx` imports resolve correctly. Two GitHub Actions workflows: `scraper-ci.yml` for PR gating, `scraper-deploy.yml` for build + deploy on merge or manual trigger.

**Tech Stack:** Python 3.11-slim Docker image, GitHub Actions, GHCR (`docker/login-action`, `docker/metadata-action`, `docker/build-push-action`), `appleboy/ssh-action` for VPS deploy.

**Working directory:** All paths below are relative to the worktree root at `.worktrees/scrapling-datasource/`.

---

## Chunk 1: Dockerfile + CI Workflow

### Task 1: Dockerfile and .dockerignore

**Files:**

- Create: `apps/scraper/Dockerfile`
- Create: `apps/scraper/.dockerignore`

**Why the `COPY . ./scraper/` pattern:** `main.py` and all modules use `from scraper.xxx import ...`. Docker build context is `apps/scraper/`, so we copy its contents into a `scraper/` subdirectory under WORKDIR. This makes `scraper` importable as a package from WORKDIR and `uvicorn scraper.main:app` works correctly.

- [ ] **Step 1: Create `.dockerignore`**

```
# apps/scraper/.dockerignore
**/__pycache__/
*.py[cod]
*.pyo
.pytest_cache/
tests/
pyproject.toml
.env
.gitignore
*.md
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# apps/scraper/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements first — pip install layer is cached until requirements change
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source as the 'scraper' package so "from scraper.xxx" imports resolve
COPY . ./scraper/

EXPOSE 8000

CMD ["uvicorn", "scraper.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Verify Dockerfile syntax and build locally (skip if Docker not installed locally)**

```bash
cd .worktrees/scrapling-datasource
docker build -t scraper-local -f apps/scraper/Dockerfile apps/scraper/
```

Expected: image builds successfully, final layer shows `scraper/main.py` etc. under `/app/scraper/`.

If Docker is not available locally, proceed to Step 4 — the CI workflow will validate on first push.

- [ ] **Step 4: Commit**

```bash
cd .worktrees/scrapling-datasource
git add apps/scraper/Dockerfile apps/scraper/.dockerignore
git commit -m "feat(scraper): add Dockerfile and .dockerignore"
```

---

### Task 2: CI workflow — pytest on pull requests

**Files:**

- Create: `.github/workflows/scraper-ci.yml`

This workflow runs pytest whenever a PR touches `apps/scraper/**`. It gives contributors fast feedback before anything is merged. The install and test commands mirror how tests are run locally (`cd apps/scraper && pytest tests/ -v`).

- [ ] **Step 1: Create `.github/workflows/scraper-ci.yml`**

```yaml
# .github/workflows/scraper-ci.yml
name: 🐍 Scraper CI

on:
  pull_request:
    paths:
      - "apps/scraper/**"

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    name: pytest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: apps/scraper/requirements.txt

      - name: Install dependencies
        run: pip install -r apps/scraper/requirements.txt

      - name: Run tests
        run: cd apps/scraper && pytest tests/ -v
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/scraper-ci.yml')); print('YAML OK')"
```

Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/scraper-ci.yml
git commit -m "feat(ci): add scraper pytest CI workflow"
```

---

## Chunk 2: Deploy Workflow

### Task 3: CD workflow — build, push to GHCR, SSH deploy

**Files:**

- Create: `.github/workflows/scraper-deploy.yml`

**Three jobs in sequence:**

1. `test` — pytest (same as CI, blocks deploy if tests fail)
2. `build-push` — build Docker image, push `:latest` + `:sha-<SHA>` tags to GHCR
3. `deploy` — SSH into VPS, pull new image, restart container

**Key details:**

- `GITHUB_TOKEN` with `packages: write` is sufficient for GHCR — no extra PAT needed
- `docker/metadata-action` generates both tags automatically from `github.sha`
- Image name: `ghcr.io/${{ github.repository_owner }}/flash-scraper` (lowercase owner enforced by GHCR)
- `cache-from`/`cache-to` with `type=gha` speeds up repeat builds using GitHub's Actions cache
- Deploy script uses `&&` chaining: if `docker pull` fails, stop/rm are skipped, old container keeps running
- `|| true` on `docker stop`/`rm` makes the script safe on first deploy when no container exists

- [ ] **Step 1: Create `.github/workflows/scraper-deploy.yml`**

```yaml
# .github/workflows/scraper-deploy.yml
name: 🚀 Scraper Deploy

on:
  push:
    branches:
      - main
    paths:
      - "apps/scraper/**"
  workflow_dispatch:
    # Manual trigger — always deploys HEAD of main regardless of changed files

concurrency:
  group: scraper-deploy-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  packages: write

jobs:
  test:
    name: pytest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: apps/scraper/requirements.txt

      - name: Install dependencies
        run: pip install -r apps/scraper/requirements.txt

      - name: Run tests
        run: cd apps/scraper && pytest tests/ -v

  build-push:
    name: Build and push Docker image
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/flash-scraper
          tags: |
            type=raw,value=latest
            type=sha,prefix=sha-,format=long

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: apps/scraper
          file: apps/scraper/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    needs: build-push
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          # Hardcode port 22; if VPS uses a different port, edit this value directly
          port: 22
          script: |
            IMAGE=ghcr.io/${{ github.repository_owner }}/flash-scraper:latest
            # Pull first; only stop/remove/restart if pull succeeds
            if docker pull $IMAGE; then
              docker stop scraper || true
              docker rm scraper || true
              docker run -d \
                --name scraper \
                --restart unless-stopped \
                --env-file /opt/scraper/.env \
                -p 8000:8000 \
                $IMAGE
            else
              echo "docker pull failed — existing container left running" >&2
              exit 1
            fi
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/scraper-deploy.yml')); print('YAML OK')"
```

Expected: `YAML OK`

- [ ] **Step 3: Check that both workflow files are present**

```bash
ls .github/workflows/scraper-*.yml
```

Expected:

```
.github/workflows/scraper-ci.yml
.github/workflows/scraper-deploy.yml
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/scraper-deploy.yml
git commit -m "feat(ci): add scraper build and deploy workflow"
```

---

## Post-implementation checklist (manual, not automated)

Before the first deploy succeeds, the repo owner must:

1. **Add GitHub Secrets** (repo Settings → Secrets and Variables → Actions):
   - `VPS_HOST` — IP or hostname
   - `VPS_USER` — SSH username
   - `VPS_SSH_KEY` — private key content (generate with `ssh-keygen -t ed25519`)
   - `VPS_PORT` — **not used** (port 22 is hardcoded in the workflow; edit the workflow file directly if your VPS uses a different port)

2. **VPS one-time setup:**

   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # log out and back in

   # Create env file
   sudo mkdir -p /opt/scraper
   sudo nano /opt/scraper/.env
   # Paste: NODE_API_URL, INTERNAL_API_KEY, SCRAPE_INTERVAL_MINUTES, SCRAPE_TIMEOUT_SECONDS

   # If repo is private — authenticate GHCR on VPS (classic PAT with read:packages)
   docker login ghcr.io -u <github-username> -p <PAT>
   ```

3. **GHCR image visibility** — after first push, go to GitHub → Packages → flash-scraper → Package settings → change visibility to Public (if desired, to skip VPS login).
