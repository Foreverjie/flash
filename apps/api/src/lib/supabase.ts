import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@flash/database/constant"
import { createClient } from "@supabase/supabase-js"

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env",
  )
}

/**
 * Supabase client for server-side operations
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // Server-side, no persistence needed
    detectSessionInUrl: false,
  },
})

/**
 * Create Supabase client with custom access token (for authenticated requests)
 */
export function createAuthenticatedClient(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase credentials")
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
