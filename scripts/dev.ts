// scripts/dev.ts
import chalk from "chalk"

import type { AppName } from "./dev/apps"
import { APPS } from "./dev/apps"
import { HELP_TEXT, parseDevArgs } from "./dev/args"
import { runPreflight } from "./dev/preflight/index"
import { ShutdownCoordinator } from "./dev/shutdown"
import { spawnApp } from "./dev/spawn"

async function main(): Promise<void> {
  const parsed = parseDevArgs(process.argv.slice(2))

  if (parsed.mode === "help") {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  if (parsed.mode === "error") {
    console.error(chalk.red(`error: ${parsed.message}`))
    console.error(`\n${HELP_TEXT}`)
    process.exit(2)
  }

  const { apps, fix } = parsed

  const ok = await runPreflight(apps, fix)
  if (!ok) process.exit(1)

  const prefixWidth = apps.reduce((max, n) => Math.max(max, n.length), 0)
  const running = apps.map((name: AppName) => spawnApp(APPS[name], prefixWidth))

  console.log(chalk.bold(`Starting ${apps.length} app(s): ${apps.join(", ")}\n`))

  const coordinator = new ShutdownCoordinator(running)
  coordinator.install()

  const exitCode = await coordinator.wait()
  process.exit(exitCode)
}

main().catch((err) => {
  console.error(chalk.red("[dev] fatal:"), err)
  process.exit(1)
})
