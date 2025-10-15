import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import healthRouter from "./health"

describe("Health Route", () => {
  it("should return health status", async () => {
    const app = new Hono()
    app.route("/health", healthRouter)

    const res = await app.request("/health")
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveProperty("status", "ok")
    expect(data).toHaveProperty("timestamp")
  })
})
