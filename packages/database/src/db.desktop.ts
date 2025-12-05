import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

import { POSTGRES_URL } from "./constant"
import * as schema from "./schemas"

let db: PostgresJsDatabase<typeof schema>
let client: postgres.Sql

export async function initializeDB() {
  if (!POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined")
  }
  // Create PostgreSQL client
  client = postgres(POSTGRES_URL, {
    max: 10, // Connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
  })

  db = drizzle(client, {
    schema,
    logger: false,
  })
}

export { db }

export async function migrateDB() {
  try {
    // Use absolute path or path relative to the package root
    const migrationsFolder = decodeURIComponent(new URL("drizzle", import.meta.url).pathname)
    await migrate(db, { migrationsFolder })
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
  throw new Error("Database deletion is not supported for PostgreSQL")
}
