# `scraper-deploy.yml`

## Function

Tests the scraper service, builds and pushes a Docker image to GHCR, then deploys the latest image to a VPS.

## Trigger

- Push to `main` when `apps/scraper/**` changes
- Manual `workflow_dispatch`

## Affected Modules

- `apps/scraper`
- `apps/scraper/Dockerfile`
- GHCR container image `flash-scraper`
- VPS runtime deployment for scraper service

## Inputs, Secrets, Environment

- Secret: `GITHUB_TOKEN`
- Secret: `VPS_HOST`
- Secret: `VPS_USER`
- Secret: `VPS_SSH_KEY`

## Flow Logic

1. Run `test` job:
   - checkout code
   - setup Python 3.11
   - install requirements
   - run pytest
2. Run `build-push` job after tests pass:
   - checkout code
   - setup Docker Buildx
   - login to GHCR
   - compute Docker image tags with `docker/metadata-action`
   - build and push image from `apps/scraper/Dockerfile`
3. Run `deploy` job after image push succeeds:
   - connect to VPS over SSH
   - pull `ghcr.io/<owner>/flash-scraper:latest`
   - if pull succeeds:
     - stop old `scraper` container
     - remove old container
     - start new container with `/opt/scraper/.env`
   - if pull fails:
     - leave existing container running
     - exit with failure

## Outputs and Side Effects

- Published GHCR Docker image
- Updated scraper service container on the VPS

## Notes

- The deploy step is intentionally defensive: it does not stop the old container until the new image is pulled successfully.
