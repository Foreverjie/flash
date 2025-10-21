/**
 * PostgreSQL Migration Utilities
 *
 * This file now uses Drizzle's built-in PostgreSQL migrator.
 * The custom migrator logic has been replaced with the standard approach.
 *
 * Usage:
 * import { migrate } from "drizzle-orm/postgres-js/migrator"
 * await migrate(db, { migrationsFolder: "./src/drizzle" })
 */

// Re-export for backwards compatibility
export { migrate } from "drizzle-orm/postgres-js/migrator"
