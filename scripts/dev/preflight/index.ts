import chalk from "chalk"
import path from "pathe"

import type { AppName } from "../apps"
import { APPS } from "../apps"
import { checkEnvParity, fixEnvFile } from "./env"
import { killOccupant, probePort } from "./ports"
import type { CheckResult } from "./toolchain"
import {
  checkNode,
  checkPnpm,
  checkPython,
  checkScraperDeps,
  readPnpmVersion,
  readRootEngines,
} from "./toolchain"

const NODE_FALLBACK = "^20.19.0 || >=22.12.0"

export async function runPreflight(selected: AppName[], autoFix: boolean): Promise<boolean> {
  console.log(chalk.bold("\nPreflight\n"))

  const toolchain = await runToolchain(selected)
  printSection("Toolchain", toolchain)

  const env = await runEnv(selected, autoFix)
  printSection(".env parity", env)

  const ports = await runPorts(selected, autoFix)
  printSection("Ports", ports)

  const all = [...toolchain, ...env, ...ports]
  const passed = all.filter((r) => r.ok).length
  const failed = all.length - passed

  console.log(chalk.gray("─".repeat(40)))
  if (failed === 0) {
    console.log(chalk.green(`✓ ${passed} passed`))
  } else {
    console.log(chalk.red(`✗ ${failed} failed`) + chalk.gray(`, ${passed} passed`))
    if (!autoFix) console.log(chalk.gray("\nRun with --fix to auto-resolve."))
  }
  console.log("")
  return failed === 0
}

function printSection(title: string, rows: CheckResult[]): void {
  console.log(chalk.bold(title))
  for (const r of rows) {
    const mark = r.ok ? chalk.green("✓") : chalk.red("✗")
    console.log(`  ${mark} ${r.label} — ${r.detail}`)
    if (!r.ok && r.fix) console.log(chalk.gray(`    fix: ${r.fix}`))
  }
  console.log("")
}

async function runToolchain(selected: AppName[]): Promise<CheckResult[]> {
  const rows: CheckResult[] = []

  try {
    const nodeRange = await readRootEngines(NODE_FALLBACK)
    rows.push(await checkNode(nodeRange))
  } catch (err) {
    rows.push({
      ok: false,
      label: "node",
      detail: `could not read engines.node from root package.json: ${(err as Error).message}`,
    })
  }

  try {
    const pnpmVersion = await readPnpmVersion()
    rows.push(await checkPnpm(pnpmVersion))
  } catch (err) {
    rows.push({
      ok: false,
      label: "pnpm",
      detail: `could not read packageManager from root package.json: ${(err as Error).message}`,
    })
  }

  if (selected.includes("scraper")) {
    rows.push(await checkPython("3.11"))
    rows.push(await checkScraperDeps())
  }

  return rows
}

async function runEnv(selected: AppName[], autoFix: boolean): Promise<CheckResult[]> {
  const rows: CheckResult[] = []
  for (const name of selected) {
    const app = APPS[name]
    if (!app.envExample) {
      rows.push({ ok: true, label: name, detail: "no .env.example (skipped)" })
      continue
    }
    const envPath = path.join(app.cwd, ".env")
    const result = await checkEnvParity({ envExample: app.envExample, envPath })
    if (result.ok) {
      rows.push({ ok: true, label: name, detail: `${path.relative(app.cwd, envPath)} in sync` })
      continue
    }
    if (result.reason === "missing-env") {
      if (autoFix) {
        await fixEnvFile({ envExample: app.envExample, envPath, action: "copy" })
        rows.push({
          ok: true,
          label: name,
          detail: `copied .env.example → .env (fill in secrets before first real use)`,
        })
      } else {
        rows.push({
          ok: false,
          label: name,
          detail: `.env missing`,
          fix: `cp ${path.relative(process.cwd(), app.envExample)} ${path.relative(process.cwd(), envPath)}`,
        })
      }
      continue
    }
    // missing-keys
    if (autoFix) {
      await fixEnvFile({
        envExample: app.envExample,
        envPath,
        action: "append",
        missingKeys: result.keys,
      })
      rows.push({
        ok: true,
        label: name,
        detail: `appended ${result.keys.length} key(s): ${result.keys.join(", ")} (values may be placeholders)`,
      })
    } else {
      rows.push({
        ok: false,
        label: name,
        detail: `missing keys: ${result.keys.join(", ")}`,
        fix: `add the keys above, or run with --fix`,
      })
    }
  }
  return rows
}

async function runPorts(selected: AppName[], autoFix: boolean): Promise<CheckResult[]> {
  const rows: CheckResult[] = []
  for (const name of selected) {
    const app = APPS[name]
    const probe = await probePort(app.port)
    if (probe.free) {
      rows.push({ ok: true, label: `${app.port} (${name})`, detail: "free" })
      continue
    }
    const occupantStr = probe.pid
      ? `pid ${probe.pid}${probe.command ? ` (${probe.command})` : ""}`
      : "unknown occupant"
    if (autoFix && probe.pid) {
      await killOccupant(probe.pid)
      const recheck = await probePort(app.port)
      if (recheck.free) {
        rows.push({ ok: true, label: `${app.port} (${name})`, detail: `killed ${occupantStr}` })
      } else {
        rows.push({
          ok: false,
          label: `${app.port} (${name})`,
          detail: `still occupied after kill`,
        })
      }
    } else {
      rows.push({
        ok: false,
        label: `${app.port} (${name})`,
        detail: `in use by ${occupantStr}`,
        fix: probe.pid ? `kill ${probe.pid}, or run with --fix` : "investigate the occupant",
      })
    }
  }
  return rows
}
