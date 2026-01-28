/**
 * Supabase PostgreSQL client configuration
 * Uses postgres.js for Drizzle ORM compatibility
 */
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema.ts"

// Get connection string from environment
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error("DATABASE_URL or POSTGRES_URL environment variable is required")
}

// Create PostgreSQL client with connection pooling
// For Vercel serverless, use lower pool size
const client = postgres(connectionString, {
  max: process.env.VERCEL ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for Vercel/PgBouncer
})

// Create Drizzle instance with schema
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
})

// Export client for direct queries if needed
export { client }

// Export schema for use in other parts of the app
export * from "./schema.ts"
