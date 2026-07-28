import { readFileSync } from "node:fs"

import tsconfigPath from "vite-tsconfig-paths"
import { defineProject } from "vitest/config"

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version?: string }

export default defineProject({
  test: {
    globals: true,
    environment: "happy-dom",
  },
  define: {
    APP_VERSION: JSON.stringify(pkg.version ?? "0.0.0"),
    APP_NAME: JSON.stringify(pkg.name),
    APP_DEV_CWD: JSON.stringify(process.cwd()),
    GIT_COMMIT_SHA: "'SHA'",
    DEBUG: process.env.DEBUG === "true",
    ELECTRON: "false",
  },
  plugins: [
    tsconfigPath({
      projects: ["./tsconfig.json"],
    }),
  ],
})
