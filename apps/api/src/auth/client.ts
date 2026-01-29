/**
 * Better-auth client for server-side operations
 * Used for programmatic authentication in route handlers
 */
import { createAuthClient } from "better-auth/client"

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return process.env.BETTER_AUTH_URL || "http://localhost:3001"
}

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: "/api/auth",
})
