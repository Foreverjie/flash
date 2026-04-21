// scripts/dev/apps.ts
import { fileURLToPath } from "node:url"

import path from "pathe"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")

export type AppName = "api" | "ssr" | "desktop" | "scraper"

export type AppSpec = {
  name: AppName
  cwd: string
  cmd: string
  args: string[]
  color: "cyan" | "magenta" | "green" | "yellow"
  port: number
  envExample?: string // absolute path, if one exists
}

export const APPS: Record<AppName, AppSpec> = {
  api: {
    name: "api",
    cwd: path.join(repoRoot, "apps/api"),
    cmd: "pnpm",
    args: ["run", "dev"],
    color: "cyan",
    port: 3001,
    envExample: path.join(repoRoot, "apps/api/.env.example"),
  },
  ssr: {
    name: "ssr",
    cwd: path.join(repoRoot, "apps/ssr"),
    cmd: "pnpm",
    args: ["run", "dev"],
    color: "magenta",
    port: 2234,
  },
  desktop: {
    name: "desktop",
    cwd: path.join(repoRoot, "apps/desktop"),
    cmd: "pnpm",
    args: ["run", "dev:web"],
    color: "green",
    port: 5173,
    envExample: path.join(repoRoot, "apps/desktop/.env.example"),
  },
  scraper: {
    name: "scraper",
    cwd: path.join(repoRoot, "apps/scraper"),
    cmd: "uvicorn",
    args: ["scraper.main:app", "--reload", "--port", "8000"],
    color: "yellow",
    port: 8000,
    envExample: path.join(repoRoot, "apps/scraper/.env.example"),
  },
}

export const DEFAULT_APPS: AppName[] = ["api", "ssr", "desktop"]
