# API CI/CD Configuration

This document describes the Continuous Integration and Continuous Deployment setup for the Follow API module.

## Overview

The API CI workflow runs automatically on:

- **Push** to `main` or `develop` branches
- **Pull requests** targeting any branch
- Changes to API code, shared packages, or configuration files

## Workflow Structure

### 1. Quality Checks Job

Runs code quality validations in parallel:

- ✅ **Type Checking** - Ensures TypeScript correctness
- ✅ **Linting** - Enforces code style (ESLint)
- ✅ **Tests** - Runs Vitest test suite

**Duration**: ~5 minutes

### 2. Build Job

Builds the production-ready API bundle:

- ✅ Compiles TypeScript to JavaScript
- ✅ Creates optimized bundle with tsup
- ✅ Uploads build artifacts

**Duration**: ~3 minutes

### 3. Summary Job

Reports overall CI status:

- ✅ Checks if all jobs passed
- ✅ Provides clear pass/fail status

---

## Trigger Paths

The workflow triggers on changes to:

```yaml
apps/api/**              # API source code
packages/internal/**     # Shared packages
package.json             # Dependencies
pnpm-lock.yaml          # Lockfile
pnpm-workspace.yaml     # Workspace config
turbo.json              # Monorepo config
tsconfig.json           # TypeScript config
eslint.config.mjs       # Linting config
.github/workflows/api-ci.yml  # This workflow
```

---

## Local Development

Run the same checks locally before pushing:

```bash
cd apps/api

# 1. Type checking (required)
pnpm typecheck

# 2. Linting (required)
pnpm lint:fix

# 3. Tests (required)
pnpm test

# 4. Build (optional)
pnpm build
```

### Quick Check All

Run all checks at once:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

---

## CI Environments

### Environment Variables

Currently, no environment variables are required for CI.

Future additions (when database is integrated):

- `DATABASE_URL` - Database connection string
- `API_KEY` - External API keys
- `JWT_SECRET` - Session secret

### Node.js Version

- **Node**: 20.x LTS
- **pnpm**: 10.17.0

---

## Workflow Jobs Details

### Job 1: quality-checks

```yaml
Timeout: 10 minutes
Runs on: ubuntu-latest
```

**Steps:**

1. Checkout code
2. Setup pnpm & Node.js
3. Install dependencies
4. Build shared packages (required for type checking)
5. Run type checking
6. Run linting
7. Run tests

**Failure Conditions:**

- TypeScript errors
- ESLint errors
- Test failures
- Timeout (>10 minutes)

### Job 2: build

```yaml
Timeout: 10 minutes
Runs on: ubuntu-latest
Depends on: quality-checks
```

**Steps:**

1. Checkout code
2. Setup pnpm & Node.js
3. Install dependencies
4. Build shared packages
5. Build API bundle
6. Upload artifacts

**Output Artifacts:**

- `api-dist/` - Production build files
- Retention: 7 days

### Job 3: summary

```yaml
Runs on: ubuntu-latest
Depends on: quality-checks, build
Runs: always (even if previous jobs fail)
```

**Purpose:**

- Provide clear CI status
- Fail workflow if any job failed
- Show emoji indicators (✅/❌)

---

## Troubleshooting

### Common CI Failures

#### 1. Type Checking Fails

```bash
# Local fix
pnpm typecheck

# Common issues:
- Missing type imports
- Incorrect type usage
- Outdated @types/* packages
```

#### 2. Linting Fails

```bash
# Auto-fix locally
pnpm lint:fix

# Common issues:
- Code style violations
- Unused imports
- Console.log statements (use console.info/warn/error)
```

#### 3. Tests Fail

```bash
# Run tests locally
pnpm test

# Common issues:
- Breaking changes to APIs
- Missing mock data
- Async timing issues
```

#### 4. Build Fails

```bash
# Build locally
pnpm build

# Common issues:
- Import path errors (.js extensions required)
- Missing dependencies
- tsup configuration errors
```

---

## Performance Optimization

### Caching

The workflow uses GitHub Actions caching:

- **pnpm cache** - Dependencies (~1-2 minutes saved)
- **Node modules** - Installed packages

### Parallel Execution

Jobs run in parallel when possible:

- Quality checks run together
- Build waits for quality checks

### Timeouts

All jobs have 10-minute timeouts to prevent hung jobs.

---

## Future Enhancements

### Planned Additions

1. **Docker Build**
   - Build Docker image
   - Push to container registry
   - Run container health checks

2. **E2E Tests**
   - Integration testing with real HTTP requests
   - Database integration tests (once DB is added)
   - API contract testing

3. **Performance Testing**
   - Load testing
   - Response time benchmarks
   - Memory usage profiling

4. **Security Scanning**
   - Dependency vulnerability scanning
   - Secret detection
   - SAST (Static Application Security Testing)

5. **Deployment**
   - Auto-deploy to staging on `develop`
   - Manual approval for production
   - Rollback capabilities

6. **Code Coverage**
   - Upload coverage reports
   - Enforce minimum coverage thresholds
   - Visualize coverage trends

---

## Badges

Add to README.md:

```markdown
[![API CI](https://github.com/Foreverjie/flash/workflows/API%20CI/badge.svg)](https://github.com/Foreverjie/flash/actions/workflows/api-ci.yml)
```

---

## Status Checks

### Required Checks (Branch Protection)

Recommended for `main` branch:

- ✅ quality-checks
- ✅ build
- ✅ summary

### Configuration

In repository settings:

1. Go to **Settings** → **Branches**
2. Add rule for `main`
3. Enable "Require status checks to pass"
4. Select: `quality-checks`, `build`, `summary`

---

## Debugging CI Issues

### View Logs

1. Go to **Actions** tab
2. Click on failed workflow run
3. Click on failed job
4. Expand failed step

### Re-run Failed Jobs

```bash
# From GitHub UI:
Actions → Failed workflow → Re-run failed jobs

# Or re-run all jobs:
Actions → Failed workflow → Re-run all jobs
```

### Local Simulation

Run in clean environment (similar to CI):

```bash
# Clean install
rm -rf node_modules
pnpm install --frozen-lockfile

# Run checks
pnpm --filter @follow/api typecheck
pnpm --filter @follow/api lint
pnpm --filter @follow/api test
pnpm --filter @follow/api build
```

---

## Contact

For CI/CD issues:

- Check workflow logs first
- Review this documentation
- Ask in team chat
- Create issue with "CI" label
