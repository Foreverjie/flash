/**
 * Vitest Test Setup
 * Global configuration for integration tests
 *
 * IMPORTANT: dotenv/config must be the first import to load environment
 * variables before any other modules that depend on them (like db).
 */
import "dotenv/config"

import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll } from "vitest"

import { cleanupAllTestData } from "./mocks/auth.js"
import { handlers } from "./mocks/handlers.js"

// Set test environment
process.env.NODE_ENV = "test"
// Prevent the server from starting during tests
process.env.VERCEL = "1"

// Create MSW server with default handlers
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" })
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

// Close server and cleanup after all tests
afterAll(async () => {
  server.close()
  // Clean up test data from database
  await cleanupAllTestData()
})
