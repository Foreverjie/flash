import { defineConfig, devices } from "@playwright/test"

/**
 * E2E suite for the new-user critical path.
 *
 * Boots the API (port 3001) and the web renderer (port 2233) against a
 * dedicated Postgres provided via E2E_DATABASE_URL. The stack runs with:
 *   - RESEND_API_KEY unset  → emails are written to MAIL_OUTPUT_DIR
 *   - HCAPTCHA_SECRET unset → captcha verification skipped server-side
 *
 * Locally: start Postgres and run migrations + seed first, e.g.
 *   docker run -d --name flash-e2e-pg -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=flash_e2e -p 54329:5432 postgres:16-alpine
 *   cd apps/api && DATABASE_URL=postgres://postgres:test@localhost:54329/flash_e2e \
 *     pnpm exec drizzle-kit migrate && DATABASE_URL=... pnpm run db:seed:e2e
 *   E2E_DATABASE_URL=postgres://postgres:test@localhost:54329/flash_e2e pnpm test
 */

const DATABASE_URL =
  process.env.E2E_DATABASE_URL || "postgres://postgres:test@localhost:54329/flash_e2e"

// The whole stack is local; never let a system HTTP(S) proxy intercept
// localhost traffic (readiness probes and browser requests alike).
process.env.NO_PROXY = "localhost,127.0.0.1"
process.env.no_proxy = "localhost,127.0.0.1"
for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
  delete process.env[key]
}

export const MAIL_OUTPUT_DIR = new URL(".mail", import.meta.url).pathname

// The renderer's vite config pins the dev server to port 2233
const WEB_URL = "http://localhost:2233"
const API_URL = "http://localhost:3001"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--no-proxy-server"] },
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --dir ../apps/api run dev",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL,
        PORT: "3001",
        BETTER_AUTH_URL: API_URL,
        BETTER_AUTH_SECRET: "e2e-test-secret-not-for-production",
        FRONTEND_URL: WEB_URL,
        MAIL_OUTPUT_DIR,
        NODE_ENV: "development",
        // Explicitly unset external services so the env seams engage
        RESEND_API_KEY: "",
        HCAPTCHA_SECRET: "",
        // Dummy OAuth apps so provider buttons render; tests assert the
        // authorize redirect and never complete the external login.
        GITHUB_CLIENT_ID: "e2e-dummy-github",
        GITHUB_CLIENT_SECRET: "e2e-dummy-github-secret",
        GOOGLE_CLIENT_ID: "e2e-dummy-google",
        GOOGLE_CLIENT_SECRET: "e2e-dummy-google-secret",
      },
    },
    {
      command: "pnpm --dir ../apps/desktop run dev:web",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_URL: API_URL,
        VITE_WEB_URL: WEB_URL,
        // The react-scan dev toolbar overlay intercepts pointer events
        VITE_DISABLE_REACT_SCAN: "1",
      },
    },
  ],
})
