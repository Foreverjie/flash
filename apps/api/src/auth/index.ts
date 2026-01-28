/**
 * Better-auth configuration with Drizzle adapter
 * Supports Email/Password authentication with Supabase PostgreSQL
 */
import { stripe } from "@better-auth/stripe"
import bcrypt from "bcrypt"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, anonymous, twoFactor } from "better-auth/plugins"
import Stripe from "stripe"

import { db } from "../db/index.js"
import * as schema from "../db/schema.js"

// Get base URL for callbacks
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return process.env.BETTER_AUTH_URL || "http://localhost:3001"
}

// Initialize Stripe client if credentials are provided
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

/**
 * Better Auth configuration
 * Uses Drizzle adapter for database operations
 */
export const auth = betterAuth({
  // Use Drizzle adapter with our schema
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // Base URL configuration
  baseURL: getBaseUrl(),
  basePath: "/api/auth",

  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET,

  // Email and password configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production",
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, 12)
      },
      verify: async ({ hash, password }) => {
        return bcrypt.compare(password, hash)
      },
    },
    sendResetPassword: async ({ user, url }) => {
      // TODO: Integrate with email service (Resend, SendGrid, etc.)
      console.info(`[Auth] Password reset requested for ${user.email}`)
      console.info(`[Auth] Reset URL: ${url}`)
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache for 5 minutes
    },
  },

  // User schema customization
  user: {
    additionalFields: {
      handle: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      website: {
        type: "string",
        required: false,
      },
      socialLinks: {
        type: "json",
        required: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
    },
  },

  // Social providers (optional - configure in .env)
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GITHUB_CLIENT_ID),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    },
  },

  // Cookie configuration
  advanced: {
    cookiePrefix: "follow-auth",
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // Plugins
  plugins: [
    // Two-factor authentication
    twoFactor({
      issuer: "Follow",
    }),

    // Admin capabilities
    admin(),

    // Anonymous sessions
    anonymous(),

    // Stripe integration (if configured)
    ...(stripeClient && process.env.STRIPE_WEBHOOK_SECRET
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        ]
      : []),
  ],

  // Rate limiting (disabled in test environment)
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    window: 60, // 1 minute
    max: 100, // 100 requests per minute
  },

  // Trusting host header in Vercel
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ].filter(Boolean) as string[],
})

// Export auth types for use in middleware
export type Auth = typeof auth
export type Session = typeof auth.$Infer.Session
export type User = Session["user"]
