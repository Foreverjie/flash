import { Hono } from "hono"

import { authClient } from "../lib/auth-client.js"
import { supabase } from "../lib/supabase.js"
import { authMiddleware } from "../middleware/auth.js"
import {
  createAuthorizationCode,
  decodeAuthorizationCode,
  verifyCodeChallenge,
} from "../utils/pkce.js"
import { structuredError, structuredSuccess } from "../utils/response.js"

type Variables = {
  userId: string
  userEmail?: string
  userRole?: string
}

const auth = new Hono<{ Variables: Variables }>()

/**
 * POST /auth/sign-up
 * Register a new user with email and password
 */
auth.post("/sign-up", async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, name } = body

    if (!email || !password) {
      return c.json(structuredError("Email and password are required"), 400)
    }

    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: name || email.split("@")[0],
    })

    if (error) {
      return c.json(structuredError(error.message || "Authentication failed"), 400)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: data.user?.name,
        },
        token: data.token,
      }),
    )
  } catch (error) {
    console.error("Sign up error:", error)
    return c.json(structuredError("Failed to create account"), 500)
  }
})

/**
 * POST /auth/sign-in
 * Sign in with email and password
 */
auth.post("/sign-in", async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = body

    if (!email || !password) {
      return c.json(structuredError("Email and password are required"), 400)
    }

    const { data, error } = await authClient.signIn.email({
      email,
      password,
    })

    if (error) {
      return c.json(structuredError(error.message), 401)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          email_confirmed: data.user.email_confirmed_at !== null,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      }),
    )
  } catch (error) {
    console.error("Sign in error:", error)
    return c.json(structuredError("Failed to sign in"), 500)
  }
})

/**
 * POST /auth/sign-in/magic-link
 * Sign in with magic link (email only)
 */
auth.post("/sign-in/magic-link", async (c) => {
  try {
    const body = await c.req.json()
    const { email } = body

    if (!email) {
      return c.json(structuredError("Email is required"), 400)
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: body.redirectTo,
      },
    })

    if (error) {
      return c.json(structuredError(error.message), 400)
    }

    return c.json(
      structuredSuccess({
        message: "Magic link sent to your email",
      }),
    )
  } catch (error) {
    console.error("Magic link error:", error)
    return c.json(structuredError("Failed to send magic link"), 500)
  }
})

/**
 * POST /auth/pkce/start
 * Start PKCE authentication flow with code challenge
 * Client should generate code_verifier and code_challenge before calling this
 */
auth.post("/pkce/start", async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, code_challenge } = body

    if (!email || !password) {
      return c.json(structuredError("Email and password are required"), 400)
    }

    if (!code_challenge) {
      return c.json(structuredError("Code challenge is required for PKCE flow"), 400)
    }

    // Sign in with password to get the session
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return c.json(structuredError(error.message), 401)
    }

    // Create authorization code using PKCE utility
    const authCode = createAuthorizationCode(data.user.id, code_challenge, 600)

    return c.json(
      structuredSuccess({
        authorization_code: authCode,
        expires_in: 600, // 10 minutes
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
        },
      }),
    )
  } catch (error) {
    console.error("PKCE start error:", error)
    return c.json(structuredError("Failed to start PKCE flow"), 500)
  }
})

/**
 * POST /auth/pkce/verify
 * Verify PKCE code with code verifier and exchange for tokens
 */
auth.post("/pkce/verify", async (c) => {
  try {
    const body = await c.req.json()
    const { authorization_code, code_verifier } = body

    if (!authorization_code || !code_verifier) {
      return c.json(structuredError("Authorization code and code verifier are required"), 400)
    }

    // Decode and verify the authorization code using utility
    const codeData = decodeAuthorizationCode(authorization_code)

    if (!codeData) {
      return c.json(structuredError("Invalid or expired authorization code"), 401)
    }

    // Verify the code_verifier matches the code_challenge using utility
    if (!verifyCodeChallenge(code_verifier, codeData.challenge)) {
      return c.json(structuredError("Invalid code verifier"), 401)
    }

    // Verification successful - get user
    const { data, error } = await supabase.auth.admin.getUserById(codeData.userId)

    if (error || !data.user) {
      return c.json(structuredError("User not found"), 404)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          email_confirmed: data.user.email_confirmed_at !== null,
        },
        message: "PKCE verification successful. Use /pkce/exchange to get session tokens.",
        verified: true,
      }),
    )
  } catch (error) {
    console.error("PKCE verify error:", error)
    return c.json(structuredError("Failed to verify PKCE code"), 500)
  }
})

/**
 * POST /auth/pkce/exchange
 * Complete PKCE flow - exchange verified code for session tokens
 */
auth.post("/pkce/exchange", async (c) => {
  try {
    const body = await c.req.json()
    const { authorization_code, code_verifier } = body

    if (!authorization_code || !code_verifier) {
      return c.json(structuredError("Authorization code and code verifier are required"), 400)
    }

    // Decode and verify the authorization code using utility
    const codeData = decodeAuthorizationCode(authorization_code)

    if (!codeData) {
      return c.json(structuredError("Invalid or expired authorization code"), 401)
    }

    // Verify code_verifier using utility
    if (!verifyCodeChallenge(code_verifier, codeData.challenge)) {
      return c.json(structuredError("Invalid code verifier"), 401)
    }

    // Get user and generate session
    const { data, error } = await supabase.auth.admin.getUserById(codeData.userId)

    if (error || !data.user) {
      return c.json(structuredError("User not found"), 404)
    }

    // Generate session token via admin API
    // Note: Supabase doesn't have direct admin session creation
    // In production, you might need to implement custom JWT or use signInWithPassword
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: data.user.email!,
    })

    if (sessionError) {
      return c.json(structuredError("Failed to generate session"), 500)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          email_confirmed: data.user.email_confirmed_at !== null,
        },
        // Note: In production, return actual session tokens
        session_url: sessionData.properties.action_link,
        message:
          "PKCE exchange successful. Use the session URL or implement custom token generation.",
      }),
    )
  } catch (error) {
    console.error("PKCE exchange error:", error)
    return c.json(structuredError("Failed to exchange PKCE code"), 500)
  }
})

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
auth.post("/refresh", async (c) => {
  try {
    const body = await c.req.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return c.json(structuredError("Refresh token is required"), 400)
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    })

    if (error) {
      return c.json(structuredError(error.message), 401)
    }

    return c.json(
      structuredSuccess({
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_at: data.session?.expires_at,
        },
      }),
    )
  } catch (error) {
    console.error("Refresh token error:", error)
    return c.json(structuredError("Failed to refresh token"), 500)
  }
})

/**
 * GET /auth/session
 * Get current user session (requires authentication)
 */
auth.get("/session", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId")

    const { data, error } = await supabase.auth.admin.getUserById(userId)

    if (error) {
      return c.json(structuredError("Failed to get user session"), 401)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          email_confirmed: data.user.email_confirmed_at !== null,
          created_at: data.user.created_at,
        },
      }),
    )
  } catch (error) {
    console.error("Get session error:", error)
    return c.json(structuredError("Failed to get session"), 500)
  }
})

/**
 * POST /auth/sign-out
 * Sign out current user (requires authentication)
 */
auth.post("/sign-out", authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return c.json(structuredError("No token provided"), 401)
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.admin.signOut(token)

    if (error) {
      console.error("Sign out error:", error)
      // Continue anyway, token might be already invalid
    }

    return c.json(structuredSuccess({ message: "Signed out successfully" }))
  } catch (error) {
    console.error("Sign out error:", error)
    return c.json(structuredError("Failed to sign out"), 500)
  }
})

/**
 * POST /auth/reset-password
 * Request password reset email
 */
auth.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json()
    const { email } = body

    if (!email) {
      return c.json(structuredError("Email is required"), 400)
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: body.redirectTo,
    })

    if (error) {
      return c.json(structuredError(error.message), 400)
    }

    return c.json(
      structuredSuccess({
        message: "Password reset email sent",
      }),
    )
  } catch (error) {
    console.error("Reset password error:", error)
    return c.json(structuredError("Failed to send reset email"), 500)
  }
})

/**
 * POST /auth/update-password
 * Update user password (requires authentication)
 */
auth.post("/update-password", authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { password } = body

    if (!password) {
      return c.json(structuredError("New password is required"), 400)
    }

    const authHeader = c.req.header("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return c.json(structuredError("No token provided"), 401)
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return c.json(structuredError(error.message), 400)
    }

    return c.json(
      structuredSuccess({
        message: "Password updated successfully",
      }),
    )
  } catch (error) {
    console.error("Update password error:", error)
    return c.json(structuredError("Failed to update password"), 500)
  }
})

/**
 * GET /auth/user
 * Get current authenticated user details
 */
auth.get("/user", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId")

    const { data, error } = await supabase.auth.admin.getUserById(userId)

    if (error) {
      return c.json(structuredError("Failed to get user"), 401)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          avatar: data.user.user_metadata?.avatar_url,
          email_confirmed: data.user.email_confirmed_at !== null,
          created_at: data.user.created_at,
          updated_at: data.user.updated_at,
        },
      }),
    )
  } catch (error) {
    console.error("Get user error:", error)
    return c.json(structuredError("Failed to get user"), 500)
  }
})

/**
 * PUT /auth/user
 * Update current user profile
 */
auth.put("/user", authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { name, avatar_url } = body

    const { data, error } = await supabase.auth.updateUser({
      data: {
        name,
        avatar_url,
      },
    })

    if (error) {
      return c.json(structuredError(error.message), 400)
    }

    return c.json(
      structuredSuccess({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name,
          avatar: data.user.user_metadata?.avatar_url,
        },
      }),
    )
  } catch (error) {
    console.error("Update user error:", error)
    return c.json(structuredError("Failed to update user"), 500)
  }
})

export default auth
