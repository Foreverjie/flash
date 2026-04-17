// scripts/dev/shutdown.ts
import chalk from "chalk"

import type { RunningApp } from "./spawn"

const GRACE_MS = 5000

export class ShutdownCoordinator {
  private shuttingDown = false
  private firstFailureCode: number | null = null

  constructor(private apps: RunningApp[]) {}

  install(): void {
    process.once("SIGINT", () => this.initiate("SIGINT"))
    process.once("SIGTERM", () => this.initiate("SIGTERM"))

    for (const app of this.apps) {
      app.exited.then((code) => {
        if (this.shuttingDown) return
        // A child exited unexpectedly → fail-fast
        console.error(
          chalk.red(
            `\n[dev] ${app.spec.name} exited with code ${code ?? "null"} — shutting down\n`,
          ),
        )
        if (code !== null && code !== 0 && this.firstFailureCode === null) {
          this.firstFailureCode = code
        } else if (code === null && this.firstFailureCode === null) {
          this.firstFailureCode = 1
        }
        this.initiate("child-exit")
      })
    }
  }

  async wait(): Promise<number> {
    await Promise.all(this.apps.map((a) => a.exited))
    return this.firstFailureCode ?? 0
  }

  private initiate(reason: string): void {
    if (this.shuttingDown) return
    this.shuttingDown = true
    if (reason === "SIGINT" || reason === "SIGTERM") {
      console.log(chalk.gray(`\n[dev] received ${reason}, stopping all apps...`))
    }

    for (const app of this.apps) {
      if (app.child.exitCode === null && app.child.signalCode === null) {
        try {
          app.child.kill("SIGTERM")
        } catch {
          /* already dead */
        }
      }
    }

    setTimeout(() => {
      for (const app of this.apps) {
        if (app.child.exitCode === null && app.child.signalCode === null) {
          console.log(chalk.gray(`[dev] force-killing ${app.spec.name}`))
          try {
            app.child.kill("SIGKILL")
          } catch {
            /* already dead */
          }
        }
      }
    }, GRACE_MS).unref()
  }
}
