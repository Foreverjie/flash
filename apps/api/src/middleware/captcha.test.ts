import { Hono } from "hono"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { requireCaptcha } from "./captcha"

function buildApp() {
  const app = new Hono()
  app.use("/sign-up/email", requireCaptcha)
  app.post("/sign-up/email", (c) => c.json({ ok: true }))
  return app
}

describe("requireCaptcha", () => {
  beforeEach(() => {
    delete process.env.HCAPTCHA_SECRET
  })

  afterEach(() => {
    delete process.env.HCAPTCHA_SECRET
    vi.unstubAllGlobals()
  })

  it("skips verification when HCAPTCHA_SECRET is unset", async () => {
    const app = buildApp()
    const res = await app.request("/sign-up/email", { method: "POST" })
    expect(res.status).toBe(200)
  })

  it("rejects requests without a captcha token", async () => {
    process.env.HCAPTCHA_SECRET = "secret"
    const app = buildApp()
    const res = await app.request("/sign-up/email", { method: "POST" })
    expect(res.status).toBe(403)
  })

  it("rejects tokens that fail siteverify", async () => {
    process.env.HCAPTCHA_SECRET = "secret"
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
          ),
        ),
    )
    const app = buildApp()
    const res = await app.request("/sign-up/email", {
      method: "POST",
      headers: { "x-token": "hc:bad-token" },
    })
    expect(res.status).toBe(403)
  })

  it("allows requests with a valid token", async () => {
    process.env.HCAPTCHA_SECRET = "secret"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal("fetch", fetchMock)
    const app = buildApp()
    const res = await app.request("/sign-up/email", {
      method: "POST",
      headers: { "x-token": "hc:good-token" },
    })
    expect(res.status).toBe(200)
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]![1]!.body))
    expect(body.get("response")).toBe("good-token")
  })

  it("rejects when siteverify is unreachable", async () => {
    process.env.HCAPTCHA_SECRET = "secret"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const app = buildApp()
    const res = await app.request("/sign-up/email", {
      method: "POST",
      headers: { "x-token": "hc:token" },
    })
    expect(res.status).toBe(403)
  })
})
