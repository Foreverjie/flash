import net from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { probePort } from "../preflight/ports"

let server: net.Server | null = null
let port = 0

beforeEach(async () => {
  server = net.createServer()
  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      port = (server!.address() as net.AddressInfo).port
      resolve()
    })
  })
})

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
  }
})

describe("probePort", () => {
  it("reports occupied port as false", async () => {
    const result = await probePort(port)
    expect(result.free).toBe(false)
  })

  it("reports port as free after server closes", async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
    const result = await probePort(port)
    expect(result.free).toBe(true)
  })

  it("reports free for a plausibly-unused high port", async () => {
    // 65500-ish — unlikely to be bound. If flaky, we'll revisit.
    const result = await probePort(65533)
    expect(result.free).toBe(true)
  })
})
