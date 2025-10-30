import crypto from "node:crypto"

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Implements RFC 7636 for OAuth 2.0 PKCE flow
 */

/**
 * Generate a cryptographically secure random code verifier
 * @param length Length of the verifier (43-128 characters)
 * @returns Base64URL encoded code verifier
 */
export function generateCodeVerifier(length = 128): string {
  if (length < 43 || length > 128) {
    throw new Error("Code verifier length must be between 43 and 128 characters")
  }

  // Generate random bytes and encode as base64url
  const randomBytes = crypto.randomBytes(length)
  return base64URLEncode(randomBytes)
}

/**
 * Generate code challenge from code verifier using S256 method
 * @param verifier The code verifier
 * @returns Base64URL encoded SHA256 hash of the verifier
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest()
  return base64URLEncode(hash)
}

/**
 * Verify that a code verifier matches the code challenge
 * @param verifier The code verifier to check
 * @param challenge The code challenge to verify against
 * @returns True if verifier matches challenge
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier)
  return computedChallenge === challenge
}

/**
 * Generate both code verifier and challenge
 * @returns Object with verifier and challenge
 */
export function generatePKCEPair() {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)

  return {
    verifier,
    challenge,
    method: "S256" as const,
  }
}

/**
 * Base64URL encode a buffer (URL-safe base64 without padding)
 * @param buffer Buffer to encode
 * @returns Base64URL encoded string
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

/**
 * Create an authorization code containing user info and code challenge
 * @param userId User ID
 * @param codeChallenge The code challenge for verification
 * @param expiresIn Expiration time in seconds (default: 600 = 10 minutes)
 * @returns Base64URL encoded authorization code
 */
export function createAuthorizationCode(
  userId: string,
  codeChallenge: string,
  expiresIn = 600,
): string {
  const payload = {
    userId,
    challenge: codeChallenge,
    timestamp: Date.now(),
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

/**
 * Decode and validate an authorization code
 * @param code The authorization code to decode
 * @returns Decoded payload or null if invalid/expired
 */
export function decodeAuthorizationCode(code: string): {
  userId: string
  challenge: string
  timestamp: number
  expiresAt: number
} | null {
  try {
    const decoded = Buffer.from(code, "base64url").toString("utf-8")
    const payload = JSON.parse(decoded)

    // Validate structure
    if (!payload.userId || !payload.challenge || !payload.timestamp || !payload.expiresAt) {
      return null
    }

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Generate a secure random state parameter for OAuth flows
 * @param length Length of the state string
 * @returns Random state string
 */
export function generateState(length = 32): string {
  return crypto.randomBytes(length).toString("base64url")
}
