// scripts/dev/spawn.ts
import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"

import chalk from "chalk"

import type { AppSpec } from "./apps"

export type RunningApp = {
  spec: AppSpec
  child: ChildProcess
  exited: Promise<number | null> // resolves with exit code (null if signaled)
}

export function spawnApp(spec: AppSpec, prefixWidth: number): RunningApp {
  const child = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  })

  const colorize = chalk[spec.color]
  const prefix = colorize(`[${spec.name}]`.padEnd(prefixWidth + 2))
  const errPrefix = colorize.underline(`[${spec.name}]`.padEnd(prefixWidth + 2))

  streamLines(child.stdout!, (line) => process.stdout.write(`${prefix} ${line}\n`))
  streamLines(child.stderr!, (line) => process.stderr.write(`${errPrefix} ${line}\n`))

  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code))
  })

  return { spec, child, exited }
}

function streamLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let buf = ""
  stream.setEncoding("utf8")
  stream.on("data", (chunk: string) => {
    buf += chunk
    let idx: number
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "")
      buf = buf.slice(idx + 1)
      onLine(line)
    }
  })
  stream.on("end", () => {
    if (buf.length > 0) onLine(buf)
  })
}
