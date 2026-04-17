import { execFile } from "node:child_process"
import net from "node:net"
import { promisify } from "node:util"

const exec = promisify(execFile)

export type ProbeResult = { free: true } | { free: false; pid?: number; command?: string }

export async function probePort(port: number): Promise<ProbeResult> {
  const bindResult = await new Promise<"free" | "occupied">((resolve) => {
    const server = net.createServer()
    server.once("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        resolve("occupied")
      } else {
        resolve("occupied")
      }
    })
    server.once("listening", () => {
      server.close(() => resolve("free"))
    })
    server.listen(port, "127.0.0.1")
  })

  if (bindResult === "free") return { free: true }

  // Try to identify the occupant
  try {
    const { stdout: pidOut } = await exec("lsof", ["-i", `:${port}`, "-sTCP:LISTEN", "-t"])
    const pid = Number.parseInt(pidOut.trim().split("\n")[0], 10)
    if (!pid) return { free: false }
    try {
      const { stdout: cmdOut } = await exec("ps", ["-p", String(pid), "-o", "comm="])
      return { free: false, pid, command: cmdOut.trim() }
    } catch {
      return { free: false, pid }
    }
  } catch {
    return { free: false }
  }
}

export async function killOccupant(pid: number, graceMs = 2000): Promise<boolean> {
  if (pid === 1 || pid === process.pid) return false
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    return true // already dead
  }

  const deadline = Date.now() + graceMs
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return true // gone
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  try {
    process.kill(pid, "SIGKILL")
  } catch {
    /* already gone */
  }
  return true
}
