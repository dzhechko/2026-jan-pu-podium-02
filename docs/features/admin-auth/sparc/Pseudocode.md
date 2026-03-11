# Pseudocode: Admin Authentication

## Register
```
FUNCTION register(email, password, company_name, phone):
  1. Validate input with Zod schema
  2. Check DB for existing email → 409 if duplicate
  3. Hash password with bcrypt(12)
  4. Create admin record in DB
  5. Generate JWT pair (access + refresh)
  6. Return tokens + admin info
```

## Login
```
FUNCTION login(email, password):
  1. Validate input with Zod schema
  2. Find admin by email → 401 if not found
  3. Compare password with bcrypt → 401 if mismatch
  4. Generate JWT pair
  5. Return tokens + admin info
```

## Refresh
```
FUNCTION refresh(refresh_token):
  1. Verify refresh JWT signature and expiry
  2. Extract sub (admin_id) from payload
  3. Verify admin exists in DB → 401 if not
  4. Generate new JWT pair
  5. Return new tokens
```

## Auth Middleware
```
FUNCTION authenticate(request):
  1. Extract Bearer token from Authorization header → 401 if missing
  2. Verify access JWT → 401 if invalid/expired
  3. Attach { sub, email } to request.user
```

## Module Structure
```
packages/api/src/modules/auth/
├── schema.ts      — Zod validation schemas
├── service.ts     — AuthService class (business logic)
├── routes.ts      — Fastify route handlers
└── middleware.ts   — JWT auth middleware
```
