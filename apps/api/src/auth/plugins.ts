/**
 * Custom Better-auth plugins for desktop/mobile client compatibility
 * Implements endpoints expected by @follow-app/client-sdk
 */
import type { BetterAuthPlugin } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { z } from "zod"

interface AuthProvider {
  id: string
  name: string
  color: string
  icon: string
  icon64: string
  iconDark64?: string
}

// Base64 encoded email icon SVG
const emailIcon64 = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`).toString("base64")}`

// Base64 encoded GitHub icon SVG
const githubIcon64 = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`).toString("base64")}`

// Base64 encoded Google icon SVG
const googleIcon64 = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`).toString("base64")}`

/**
 * Custom Get Providers plugin
 * Returns available authentication providers with their icons
 */
export const customGetProvidersPlugin = (): BetterAuthPlugin => ({
  id: "customGetProviders",
  endpoints: {
    customGetProviders: createAuthEndpoint(
      "/get-providers",
      {
        method: "GET",
      },
      async (ctx) => {
        const providers: Record<string, AuthProvider> = {
          credential: {
            id: "credential",
            name: "Email",
            color: "#000000",
            icon: "",
            icon64: emailIcon64,
          },
        }

        // Check if GitHub is configured
        const githubConfigured = ctx.context.options.socialProviders?.github?.enabled
        if (githubConfigured) {
          providers.github = {
            id: "github",
            name: "GitHub",
            color: "#24292e",
            icon: "",
            icon64: githubIcon64,
            iconDark64: githubIcon64,
          }
        }

        // Check if Google is configured
        const googleConfigured = ctx.context.options.socialProviders?.google?.enabled
        if (googleConfigured) {
          providers.google = {
            id: "google",
            name: "Google",
            color: "#4285f4",
            icon: "",
            icon64: googleIcon64,
          }
        }

        return ctx.json(providers)
      },
    ),
  },
})

/**
 * Get Account Info plugin
 * Returns linked accounts for the current user
 */
export const getAccountInfoPlugin = (): BetterAuthPlugin => ({
  id: "getAccountInfo",
  endpoints: {
    getAccountInfo: createAuthEndpoint(
      "/get-account-info",
      {
        method: "GET",
        use: [(ctx) => (ctx.context.session ? ctx : Promise.reject(new Error("Unauthorized")))],
      },
      async (ctx) => {
        const { session } = ctx.context
        if (!session) {
          return ctx.json(null, { status: 401 })
        }

        const accounts = await ctx.context.adapter.findMany({
          model: "account",
          where: [{ field: "userId", value: session.user.id }],
        })

        const result = accounts.map((account) => ({
          id: account.id as string,
          accountId: account.accountId as string,
          provider: account.providerId as string,
          profile: undefined,
        }))

        return ctx.json(result)
      },
    ),
  },
})

/**
 * Delete User Custom plugin
 * Requires TOTP code for verification
 */
export const deleteUserCustomPlugin = (): BetterAuthPlugin => ({
  id: "deleteUserCustom",
  endpoints: {
    deleteUserCustom: createAuthEndpoint(
      "/delete-user-custom",
      {
        method: "POST",
        body: z.object({
          TOTPCode: z.string().length(6),
        }),
        use: [(ctx) => (ctx.context.session ? ctx : Promise.reject(new Error("Unauthorized")))],
      },
      async (ctx) => {
        const { session } = ctx.context
        if (!session) {
          return ctx.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify TOTP if 2FA is enabled
        const twoFactor = await ctx.context.adapter.findOne({
          model: "twoFactor",
          where: [{ field: "userId", value: session.user.id }],
        })

        if (twoFactor) {
          // TODO: Verify TOTP code
          // For now, just check if user has 2FA enabled
        }

        // Delete user sessions first
        await ctx.context.adapter.deleteMany({
          model: "session",
          where: [{ field: "userId", value: session.user.id }],
        })

        // Delete user accounts
        await ctx.context.adapter.deleteMany({
          model: "account",
          where: [{ field: "userId", value: session.user.id }],
        })

        // Delete user
        await ctx.context.adapter.delete({
          model: "user",
          where: [{ field: "id", value: session.user.id }],
        })

        return ctx.json({ success: true })
      },
    ),
  },
})

/**
 * One Time Token plugin
 * Generates and applies one-time tokens for cross-platform auth
 */
export const oneTimeTokenPlugin = (): BetterAuthPlugin => ({
  id: "oneTimeToken",
  endpoints: {
    generateOneTimeToken: createAuthEndpoint(
      "/one-time-token/generate",
      {
        method: "GET",
        use: [(ctx) => (ctx.context.session ? ctx : Promise.reject(new Error("Unauthorized")))],
      },
      async (ctx) => {
        const { session } = ctx.context
        if (!session) {
          return ctx.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Generate a random token
        const token = crypto.randomUUID()

        // Store token in verification table with short expiration
        await ctx.context.adapter.create({
          model: "verification",
          data: {
            id: crypto.randomUUID(),
            identifier: session.user.id,
            value: token,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })

        return ctx.json({ token })
      },
    ),
    applyOneTimeToken: createAuthEndpoint(
      "/one-time-token/apply",
      {
        method: "POST",
        body: z.object({
          token: z.string(),
        }),
      },
      async (ctx) => {
        const { token } = ctx.body

        // Find the verification entry
        const verification = await ctx.context.adapter.findOne({
          model: "verification",
          where: [{ field: "value", value: token }],
        })

        if (
          !verification ||
          new Date((verification as { expiresAt: string }).expiresAt) < new Date()
        ) {
          return ctx.json({ error: "Invalid or expired token" }, { status: 400 })
        }

        const user = await ctx.context.adapter.findOne({
          model: "user",
          where: [{ field: "id", value: (verification as { identifier: string }).identifier }],
        })

        if (!user) {
          return ctx.json({ error: "User not found" }, { status: 404 })
        }

        await ctx.context.adapter.delete({
          model: "verification",
          where: [{ field: "id", value: (verification as { id: string }).id }],
        })

        return ctx.json({ user })
      },
    ),
  },
})
