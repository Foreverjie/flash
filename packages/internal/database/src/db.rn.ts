import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import { POSTGRES_URL } from "./constant"
import * as schema from "./schemas"

export let client: postgres.Sql | null = null

let db: PostgresJsDatabase<typeof schema>

export function initializeDB() {
  // Create PostgreSQL client for React Native
  // Note: React Native requires using a proxy/bridge to connect to PostgreSQL
  // For production, consider using Supabase client directly or a REST API
  if (!POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined")
  }

  client = postgres(POSTGRES_URL, {
    max: 5, // Smaller pool for mobile
    idle_timeout: 20,
    connect_timeout: 10,
  })

  db = drizzle(client, {
    schema,
    logger: false,
  })
}

export { db }

export async function migrateDB(): Promise<void> {
  try {
    await migrate(db, { migrationsFolder: "./src/drizzle" })
  } catch (error) {
    console.error("Failed to migrate database:", error)
    throw error
  }
}

export async function getDBFile() {
  throw new Error("Database export is not supported for PostgreSQL")
}

export async function exportDB() {
  throw new Error("Database export is not supported for PostgreSQL")
}

export async function deleteDB() {
  // Close the connection if needed
  if (client) {
    await client.end()
    client = null
  }
  throw new Error(
    "Database deletion is not supported for PostgreSQL. Please clear data from server.",
  )
}
