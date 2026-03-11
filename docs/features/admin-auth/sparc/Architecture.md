# Architecture: Admin Authentication

## Component Diagram

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│ Admin Panel  │────▶│  Fastify API │────▶│ PostgreSQL │
│ (React SPA)  │     │              │     │            │
│ /login       │     │ POST /auth/* │     │ admins     │
│ /register    │     │              │     │            │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐
                    │ Auth Module  │
                    │              │
                    │ schema.ts    │ ← Zod validation
                    │ service.ts   │ ← bcrypt + jose JWT
                    │ routes.ts    │ ← Fastify handlers
                    │ middleware.ts │ ← JWT verification
                    └──────────────┘
```

## Data Flow

### Registration
```
Client → POST /api/auth/register
  → Zod validation (registerSchema)
  → Check duplicate email (Prisma)
  → bcrypt.hash(password, 12)
  → Prisma.admin.create()
  → SignJWT (access 15m + refresh 7d)
  → Response { token, refresh_token, admin }
```

### Login
```
Client → POST /api/auth/login
  → Zod validation
  → Prisma.admin.findUnique(email)
  → bcrypt.compare(password, hash)
  → SignJWT pair
  → Response { token, refresh_token, admin }
```

### Token Refresh
```
Client → POST /api/auth/refresh
  → jwtVerify(refresh_token, refreshSecret)
  → Prisma.admin.findUnique(sub)
  → SignJWT new pair
  → Response { token, refresh_token }
```

## Security Architecture

| Layer | Mechanism |
|-------|-----------|
| Password storage | bcrypt, cost factor 12 |
| Token signing | HS256 via jose library |
| Access token | 15 min expiry |
| Refresh token | 7 day expiry |
| Rate limiting | 5 req / 15 min per IP on auth endpoints |
| Input validation | Zod schemas with strict types |

## Database Schema

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Dependencies

| Package | Purpose |
|---------|---------|
| bcrypt | Password hashing |
| jose | JWT sign/verify (ESM-compatible) |
| zod | Input validation |
| @prisma/client | Database access |
