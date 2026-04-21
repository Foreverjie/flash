import chalk from "chalk"

import { APPS } from "./dev/apps"
import { HELP_TEXT, parseDevArgs } from "./dev/args"
import { runPreflight } from "./dev/preflight/index"
import { ShutdownCoordinator } from "./dev/shutdown"
import { spawnApp } from "./dev/spawn"

async function main(): Promise<number> {
  const parsed = parseDevArgs(process.argv.slice(2))

  if (parsed.mode === "help") {
    console.log(HELP_TEXT)
    return 0
  }
  if (parsed.mode === "error") {
    console.error(chalk.red(`error: ${parsed.message}`))
    console.error(`\n${HELP_TEXT}`)
    return 2
  }

  const { apps, fix } = parsed

  const ok = await runPreflight(apps, fix)
  if (!ok) return 1

  const prefixWidth = apps.reduce((max, n) => Math.max(max, n.length), 0)

  console.log(chalk.bold(`Starting ${apps.length} app(s): ${apps.join(", ")}\n`))

  const running = apps.map((name) => spawnApp(APPS[name], prefixWidth))

  const coordinator = new ShutdownCoordinator(running)
  coordinator.install()

  return coordinator.wait()
}

main()
  .then((code) => {
    // Set exitCode instead of calling exit() so Node drains stdout/stderr
    // buffers before the process actually terminates. Important when dev
    // output is piped (e.g. `pnpm dev | tee log.txt`).
    process.exitCode = code
  })
  .catch((err) => {
    console.error(chalk.red("[dev] fatal:"), err)
    process.exitCode = 1
  })
