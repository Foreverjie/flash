import { initializeDB, migrateDB } from "@flash/database/db.desktop"

export { db } from "@flash/database/db.desktop"

/**
 * Initialize database connection for API server
 */
export async function setupDatabase() {
  console.info("Initializing database connection...")
  await initializeDB()
  console.info("Database connection initialized")

  console.info("Running database migrations...")
  await migrateDB()
  console.info("Database migrations completed")
}
