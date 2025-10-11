import { serve } from "@hono/node-server"

import { createApp } from "./app"

const port = Number(process.env.PORT || 8787)
const app = createApp()

console.info(`Starting Hono server on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
