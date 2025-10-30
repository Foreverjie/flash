# PKCE Authentication Flow

This document explains the PKCE (Proof Key for Code Exchange) authentication flow implementation, which provides enhanced security for OAuth 2.0 authentication, especially for public clients.

## What is PKCE?

PKCE (RFC 7636) is an extension to the OAuth 2.0 authorization flow that prevents authorization code interception attacks. It's particularly important for:

- Mobile applications
- Single-page applications (SPAs)
- Any public client that cannot securely store secrets

## How PKCE Works

### Overview

1. **Client generates** a cryptographically random `code_verifier`
2. **Client creates** a `code_challenge` by hashing the `code_verifier`
3. **Client sends** the `code_challenge` with the authorization request
4. **Server stores** the `code_challenge` with the authorization code
5. **Client exchanges** the authorization code + `code_verifier` for tokens
6. **Server verifies** that the `code_verifier` matches the stored `code_challenge`

### Security Benefits

- **No client secret needed**: Public clients don't need to store secrets
- **Prevents code interception**: Attacker can't use stolen authorization code without the verifier
- **MITM protection**: Even if authorization code is intercepted, it's useless without the verifier

## API Endpoints

### 1. Start PKCE Flow

**POST** `/auth/pkce/start`

Initialize PKCE authentication with code challenge.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "authorization_code": "eyJ1c2VySWQiOiJ1dWlkIiwidGltZXN0YW1wIjoxNzMw...",
    "expires_in": 600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

### 2. Verify PKCE Code

**POST** `/auth/pkce/verify`

Verify the authorization code with code verifier (optional step).

**Request Body:**

```json
{
  "authorization_code": "eyJ1c2VySWQiOiJ1dWlkIiwidGltZXN0YW1wIjoxNzMw...",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "email_confirmed": true
    },
    "message": "PKCE verification successful. Use /pkce/exchange to get session tokens.",
    "verified": true
  }
}
```

### 3. Exchange for Tokens

**POST** `/auth/pkce/exchange`

Exchange verified authorization code for session tokens.

**Request Body:**

```json
{
  "authorization_code": "eyJ1c2VySWQiOiJ1dWlkIiwidGltZXN0YW1wIjoxNzMw...",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "email_confirmed": true
    },
    "session_url": "https://your-project.supabase.co/auth/v1/verify?...",
    "message": "PKCE exchange successful"
  }
}
```

## Client Implementation Guide

### Step 1: Generate Code Verifier and Challenge

```typescript
import crypto from "crypto"

// Generate code verifier (43-128 characters)
function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32))
}

// Generate code challenge from verifier (S256 method)
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest()
  return base64URLEncode(hash)
}

// Base64URL encoding (URL-safe, no padding)
function base64URLEncode(buffer: Buffer): string {
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

// Usage
const codeVerifier = generateCodeVerifier()
const codeChallenge = generateCodeChallenge(codeVerifier)

// Store code_verifier securely (e.g., sessionStorage)
sessionStorage.setItem("pkce_verifier", codeVerifier)
```

### Step 2: Start Authentication Flow

```typescript
async function startPKCEAuth(email: string, password: string, codeChallenge: string) {
  const response = await fetch("/auth/pkce/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      code_challenge: codeChallenge,
    }),
  })

  const { data } = await response.json()

  // Store authorization code
  sessionStorage.setItem("auth_code", data.authorization_code)

  return data
}
```

### Step 3: Exchange for Tokens

```typescript
async function exchangePKCECode() {
  const authCode = sessionStorage.getItem("auth_code")
  const codeVerifier = sessionStorage.getItem("pkce_verifier")

  const response = await fetch("/auth/pkce/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorization_code: authCode,
      code_verifier: codeVerifier,
    }),
  })

  const { data } = await response.json()

  // Clear temporary data
  sessionStorage.removeItem("auth_code")
  sessionStorage.removeItem("pkce_verifier")

  return data
}
```

### Complete Flow Example

```typescript
async function loginWithPKCE(email: string, password: string) {
  try {
    // 1. Generate PKCE parameters
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Store verifier for later
    sessionStorage.setItem("pkce_verifier", codeVerifier)

    // 2. Start PKCE flow
    const startResponse = await fetch("/auth/pkce/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, code_challenge: codeChallenge }),
    })

    const { data: startData } = await startResponse.json()
    console.log("User info:", startData.user)

    // 3. Exchange authorization code for tokens
    const exchangeResponse = await fetch("/auth/pkce/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_code: startData.authorization_code,
        code_verifier: codeVerifier,
      }),
    })

    const { data: exchangeData } = await exchangeResponse.json()

    // 4. Clean up
    sessionStorage.removeItem("pkce_verifier")

    return exchangeData
  } catch (error) {
    console.error("PKCE login failed:", error)
    throw error
  }
}

// Usage
loginWithPKCE("user@example.com", "password123")
  .then((data) => console.log("Logged in:", data))
  .catch((err) => console.error("Login error:", err))
```

## React Native Example

```typescript
import * as Crypto from "expo-crypto"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Generate code verifier
async function generateCodeVerifier(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32)
  return base64URLEncode(Buffer.from(randomBytes))
}

// Generate code challenge
async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier)
  return base64URLEncode(Buffer.from(hash, "hex"))
}

// Complete PKCE flow
async function loginWithPKCE(email: string, password: string) {
  const verifier = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  await AsyncStorage.setItem("pkce_verifier", verifier)

  // Start flow
  const startRes = await fetch("https://api.example.com/auth/pkce/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, code_challenge: challenge }),
  })

  const { data } = await startRes.json()

  // Exchange for tokens
  const exchangeRes = await fetch("https://api.example.com/auth/pkce/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorization_code: data.authorization_code,
      code_verifier: verifier,
    }),
  })

  await AsyncStorage.removeItem("pkce_verifier")
  return exchangeRes.json()
}
```

## Server-Side Utility Functions

The API provides utility functions for PKCE operations:

```typescript
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  verifyCodeChallenge,
  createAuthorizationCode,
  decodeAuthorizationCode,
} from "./utils/pkce"

// Generate verifier and challenge pair
const { verifier, challenge, method } = generatePKCEPair()

// Verify a code verifier against challenge
const isValid = verifyCodeChallenge(verifier, challenge)

// Create authorization code
const authCode = createAuthorizationCode(userId, challenge, 600)

// Decode authorization code
const decoded = decodeAuthorizationCode(authCode)
```

## Security Considerations

### Best Practices

1. **Generate strong verifiers**: Use cryptographically secure random generators
2. **Use S256 method**: Always use SHA256 hashing, not plain method
3. **Secure storage**: Store code_verifier securely on client (not localStorage for web)
4. **Short expiration**: Authorization codes should expire quickly (10 minutes max)
5. **One-time use**: Authorization codes should only be used once
6. **HTTPS only**: Always use HTTPS in production

### Common Pitfalls

- ❌ Using predictable verifiers
- ❌ Reusing authorization codes
- ❌ Storing verifiers in localStorage (XSS risk)
- ❌ Not validating code expiration
- ❌ Using plain text instead of S256 hashing

### Production Recommendations

For production deployments:

1. **Store authorization codes in Redis** with TTL instead of encoding in JWT
2. **Implement rate limiting** on PKCE endpoints
3. **Add request signing** for additional security
4. **Monitor for replay attacks** and suspicious patterns
5. **Implement proper session management** with refresh tokens
6. **Use custom JWT generation** instead of Supabase magic links for better control

## Testing

### Test PKCE Flow with cURL

```bash
# 1. Generate code verifier and challenge (use Node.js or Python)
CODE_VERIFIER="dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
CODE_CHALLENGE="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

# 2. Start PKCE flow
curl -X POST http://localhost:3001/auth/pkce/start \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123\",\"code_challenge\":\"$CODE_CHALLENGE\"}"

# Save the authorization_code from response

# 3. Exchange for tokens
curl -X POST http://localhost:3001/auth/pkce/exchange \
  -H "Content-Type: application/json" \
  -d "{\"authorization_code\":\"YOUR_AUTH_CODE\",\"code_verifier\":\"$CODE_VERIFIER\"}"
```

## Troubleshooting

### "Invalid code verifier"

- Ensure code_verifier matches the one used to generate code_challenge
- Check that S256 hashing is used correctly
- Verify no encoding issues (must be base64url, not standard base64)

### "Authorization code has expired"

- Authorization codes expire after 10 minutes
- Reduce time between start and exchange steps
- Check system clock synchronization

### "Invalid authorization code"

- Code may have been used already (one-time use)
- Code format may be corrupted
- Check base64url decoding

## References

- [RFC 7636: PKCE Specification](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
