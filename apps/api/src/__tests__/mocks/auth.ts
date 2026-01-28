/**
 * Test Authentication Utilities
 * Helpers for simulating Better-auth login state in tests
 */
import { eq } from "drizzle-orm"

import { db } from "../../db/index.js"
import { sessions, users } from "../../db/schema.js"

/**
 * Test user data
 */
export interface TestUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: string
}

/**
 * Test session data
 */
export interface TestSession {
  id: string
  token: string
  userId: string
  expiresAt: Date
}

/**
 * Default test user
 */
export const defaultTestUser: TestUser = {
  id: "test-user-001",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  role: "user",
}

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  const user = { ...defaultTestUser, ...userData }

  await db
    .insert(users)
    .values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
    })
    .onConflictDoNothing()

  return user
}

/**
 * Create a test session for a user
 */
export async function createTestSession(
  userId: string,
  sessionData: Partial<TestSession> = {},
): Promise<TestSession> {
  const session: TestSession = {
    id: sessionData.id || `session-${Date.now()}`,
    token: sessionData.token || `test-token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    expiresAt: sessionData.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }

  await db
    .insert(sessions)
    .values({
      id: session.id,
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
    .onConflictDoNothing()

  return session
}

/**
 * Create a test user with an active session
 * Returns user, session, and headers for authenticated requests
 */
export async function createAuthenticatedUser(userData: Partial<TestUser> = {}): Promise<{
  user: TestUser
  session: TestSession
  headers: Record<string, string>
  cookieHeader: string
}> {
  const user = await createTestUser(userData)
  const session = await createTestSession(user.id)

  // Better-auth uses session token in cookie
  const cookieHeader = `follow-auth.session_token=${session.token}`

  return {
    user,
    session,
    headers: {
      Cookie: cookieHeader,
    },
    cookieHeader,
  }
}

/**
 * Delete test user and their sessions
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  // Sessions will be deleted via cascade
  await db.delete(users).where(eq(users.id, userId))
}

/**
 * Delete all test data (users starting with "test-")
 */
export async function cleanupAllTestData(): Promise<void> {
  // Delete test users - sessions cascade automatically
  const testUsers = await db.query.users.findMany({
    where: (users, { like }) => like(users.id, "test-%"),
  })

  for (const user of testUsers) {
    await db.delete(users).where(eq(users.id, user.id))
  }
}
