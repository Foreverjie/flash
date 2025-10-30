# Authentication API

This API provides complete authentication functionality using Supabase Auth as the backend, including standard email/password authentication, magic links, and PKCE (Proof Key for Code Exchange) flow for enhanced security.

## Configuration

Add the following environment variables to your `.env` file:

```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Authentication Methods

This API supports three authentication methods:

1. **Email/Password** - Traditional username and password authentication
2. **Magic Link** - Passwordless authentication via email
3. **PKCE Flow** - Enhanced security flow for public clients (mobile/SPA)

For detailed PKCE implementation guide, see [PKCE.md](./PKCE.md).

## Endpoints

### 1. Sign Up

**POST** `/auth/sign-up`

Register a new user with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe" // optional
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
      "name": "John Doe"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890
    },
    "message": "User created successfully"
  }
}
```

### 2. Sign In

**POST** `/auth/sign-in`

Sign in with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
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
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890
    }
  }
}
```

### 3. Magic Link Sign In

**POST** `/auth/sign-in/magic-link`

Send a magic link to user's email for passwordless authentication.

**Request Body:**

```json
{
  "email": "user@example.com",
  "redirectTo": "https://your-app.com/auth/callback" // optional
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "message": "Magic link sent to your email"
  }
}
```

### 4. PKCE Flow - Start

**POST** `/auth/pkce/start`

Start PKCE authentication flow with code challenge. **Recommended for mobile apps and SPAs.**

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
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

### 5. PKCE Flow - Verify

**POST** `/auth/pkce/verify`

Verify authorization code with code verifier (optional verification step).

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

### 6. PKCE Flow - Exchange

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

### 7. Refresh Token

**POST** `/auth/refresh`

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refresh_token": "your-refresh-token"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "session": {
      "access_token": "new-jwt-token",
      "refresh_token": "new-refresh-token",
      "expires_at": 1234567890
    }
  }
}
```

### 8. Get Session

**GET** `/auth/session`

Get current user session information. **Requires Authentication.**

**Headers:**

```
Authorization: Bearer <access_token>
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
      "email_confirmed": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 9. Sign Out

**POST** `/auth/sign-out`

Sign out the current user. **Requires Authentication.**

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "message": "Signed out successfully"
  }
}
```

### 10. Reset Password

**POST** `/auth/reset-password`

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com",
  "redirectTo": "https://your-app.com/reset-password" // optional
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "message": "Password reset email sent"
  }
}
```

### 11. Update Password

**POST** `/auth/update-password`

Update user's password. **Requires Authentication.**

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "password": "newSecurePassword123"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "message": "Password updated successfully"
  }
}
```

### 12. Get User

**GET** `/auth/user`

Get detailed information about the current authenticated user. **Requires Authentication.**

**Headers:**

```
Authorization: Bearer <access_token>
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
      "avatar": "https://example.com/avatar.jpg",
      "email_confirmed": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 13. Update User Profile

**PUT** `/auth/user`

Update user profile information. **Requires Authentication.**

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "name": "Jane Doe",
  "avatar_url": "https://example.com/new-avatar.jpg"
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
      "name": "Jane Doe",
      "avatar": "https://example.com/new-avatar.jpg"
    }
  }
}
```

## Authentication Flow

### Standard Email/Password Flow

1. **Sign Up**: User registers with email and password
2. **Email Verification**: User receives confirmation email (if configured in Supabase)
3. **Sign In**: User signs in with credentials
4. **Use Access Token**: Include the `access_token` in the `Authorization` header for protected routes
5. **Refresh Token**: When the access token expires, use the refresh token to get a new one
6. **Sign Out**: User signs out, invalidating the token

### Magic Link Flow

1. **Request Magic Link**: User enters their email
2. **Check Email**: User clicks the magic link in their email
3. **Redirect**: User is redirected back to your app with session tokens
4. **Use Access Token**: Use the token for authenticated requests

## Middleware

### `authMiddleware`

Requires valid authentication. Use this for protected routes.

```typescript
import { authMiddleware } from "./middleware/auth.js"

app.get("/protected", authMiddleware, async (c) => {
  const userId = c.get("userId")
  // Your protected route logic
})
```

### `optionalAuth`

Validates token if present but doesn't require authentication.

```typescript
import { optionalAuth } from "./middleware/auth.js"

app.get("/public", optionalAuth, async (c) => {
  const userId = c.get("userId") // May be undefined
  // Your logic that works for both authenticated and anonymous users
})
```

### `adminOnly`

Requires authentication and admin role.

```typescript
import { authMiddleware, adminOnly } from "./middleware/auth.js"

app.get("/admin", authMiddleware, adminOnly, async (c) => {
  // Admin-only logic
})
```

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "code": 1, // Non-zero error code
  "message": "Error description"
}
```

Common HTTP status codes:

- `400`: Bad Request (invalid input)
- `401`: Unauthorized (authentication required or failed)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Token Storage**: Store access tokens securely (e.g., httpOnly cookies or secure storage)
3. **Token Expiration**: Implement automatic token refresh before expiration
4. **Rate Limiting**: Consider adding rate limiting to prevent abuse
5. **CORS**: Configure CORS appropriately for your frontend domain
6. **Environment Variables**: Never commit `.env` files with real credentials

## Supabase Dashboard Configuration

In your Supabase project dashboard:

1. **Authentication Settings**:
   - Enable email authentication
   - Configure email templates
   - Set up redirect URLs for magic links and password reset

2. **User Management**:
   - View and manage users
   - Configure user metadata fields
   - Set up user roles (if using RLS)

3. **Email Templates**:
   - Customize confirmation emails
   - Customize password reset emails
   - Customize magic link emails

## Testing

Use tools like cURL, Postman, or HTTPie to test the endpoints:

```bash
# Sign up
curl -X POST http://localhost:3001/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Sign in
curl -X POST http://localhost:3001/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Get session (with token)
curl http://localhost:3001/auth/session \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Integration with Frontend

### Store tokens securely

```typescript
// After successful sign-in
const { data } = await fetch("/auth/sign-in", {
  method: "POST",
  body: JSON.stringify({ email, password }),
}).then((r) => r.json())

// Store tokens (example using localStorage - consider more secure options)
localStorage.setItem("access_token", data.session.access_token)
localStorage.setItem("refresh_token", data.session.refresh_token)
```

### Make authenticated requests

```typescript
const token = localStorage.getItem("access_token")

const response = await fetch("/auth/user", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
```

### Handle token refresh

```typescript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token")

  const { data } = await fetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).then((r) => r.json())

  localStorage.setItem("access_token", data.session.access_token)
  localStorage.setItem("refresh_token", data.session.refresh_token)

  return data.session.access_token
}
```
