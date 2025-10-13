import { Hono } from "hono"

import { ok } from "../types"

interface RSSHubInstance {
  id: string
  ownerUserId: string
  price: number
  userLimit: number | null
  description: string | null
  errorMessage: string | null
  errorAt: string | null
  userCount: number
  baseUrl?: string | null
  accessKey?: string | null
}

const store: { instances: RSSHubInstance[] } = {
  instances: [
    {
      id: "demo-1",
      ownerUserId: "u_1",
      price: 9.99,
      userLimit: 100,
      description: "Mock RSSHub instance",
      errorMessage: null,
      errorAt: null,
      userCount: 3,
      baseUrl: "https://rsshub.example.com",
      accessKey: null,
    },
  ],
}

function findInstance(id: string): RSSHubInstance | undefined {
  return store.instances.find((i) => i.id === id)
}

export const rsshubRoutes = new Hono()
  // POST /api/rsshub/create { id?, baseUrl, accessKey }
  .post("/create", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<RSSHubInstance> & {
      baseUrl?: string
      accessKey?: string | null
    }
    const id = body.id ?? `inst_${Date.now()}`
    const instance: RSSHubInstance = {
      id,
      ownerUserId: "u_mock",
      price: 0,
      userLimit: null,
      description: "Created via mock API",
      errorMessage: null,
      errorAt: null,
      userCount: 0,
      baseUrl: body.baseUrl ?? null,
      accessKey: body.accessKey ?? null,
    }
    store.instances.push(instance)
    return c.json(ok(null))
  })
  // GET /api/rsshub/list
  .get("/list", (c) => {
    const list = store.instances.map((i) => ({
      id: i.id,
      ownerUserId: i.ownerUserId,
      price: i.price,
      userLimit: i.userLimit,
      description: i.description,
      errorMessage: i.errorMessage,
      errorAt: i.errorAt,
      userCount: i.userCount,
      owner: null,
    }))
    return c.json(ok(list))
  })
  // POST /api/rsshub/delete { id }
  .post("/delete", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { id?: string }
    if (body.id) {
      const idx = store.instances.findIndex((i) => i.id === body.id)
      if (idx !== -1) store.instances.splice(idx, 1)
    }
    return c.json(ok(null))
  })
  // POST /api/rsshub/use { id, durationInMonths? }
  .post("/use", async (c) => {
    // const _ = await c.req.json().catch(() => ({}))
    return c.json(ok(null))
  })
  // GET /api/rsshub/get?id=...
  .get("/get", (c) => {
    const id = c.req.query("id") || ""
    const inst = id ? findInstance(id) : undefined
    const instance = inst
      ? {
          id: inst.id,
          ownerUserId: inst.ownerUserId,
          price: inst.price,
          userLimit: inst.userLimit,
          description: inst.description,
          errorMessage: inst.errorMessage,
          errorAt: inst.errorAt,
          userCount: inst.userCount,
          baseUrl: inst.baseUrl ?? null,
          accessKey: inst.accessKey ?? null,
        }
      : null
    return c.json(ok({ instance, purchase: null }))
  })
  // GET /api/rsshub/status
  .get("/status", (c) => {
    return c.json(
      ok({
        usage: {
          id: "usage-1",
          createdAt: new Date().toISOString(),
          updates: 42,
        },
        purchase: null,
      }),
    )
  })
