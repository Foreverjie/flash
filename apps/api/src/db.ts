import { initializeDB, migrateDB } from "@follow/database/db.desktop"

export { db } from "@follow/database/db.desktop"

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
