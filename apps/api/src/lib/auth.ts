import { stripe } from "@better-auth/stripe"
import { POSTGRES_URL } from "@flash/database/constant"
import bcrypt from "bcrypt"
import { betterAuth } from "better-auth"
import { admin, anonymous, twoFactor } from "better-auth/plugins"
import { Pool } from "pg"
import Stripe from "stripe"

if (!POSTGRES_URL) {
  throw new Error("POSTGRES_URL is required for Better Auth")
}

// Initialize Stripe client if credentials are provided
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    })
  : null

/**
 * Better Auth configuration for Follow API
 * Provides complete authentication with social providers, 2FA, and Stripe integration
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: POSTGRES_URL,
  }),

  // Email configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, 10)
      },
      verify: async ({ hash, password }) => {
        return bcrypt.compare(password, hash)
      },
    },
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement email sending
      console.info(`Password reset for ${user.email}: ${url}`)
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // User schema - additional fields
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
    },
  },

  // Social providers configuration
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
  },

  // Advanced options
  advanced: {
    cookiePrefix: "better-auth",
  },

  // Plugins
  plugins: [
    // Two-factor authentication
    twoFactor({
      issuer: "Follow",
    }),

    admin(),

    anonymous(),

    // Stripe integration for subscriptions
    ...(stripeClient && process.env.STRIPE_WEBHOOK_SECRET
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        ]
      : []),
  ],
})

export type Auth = typeof auth
