import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schemas/index.ts",
  out: "./src/drizzle",
  dbCredentials: {
    url: process.env.POSTGRES_URL || "",
  },
})
