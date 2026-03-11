# Security Rules: ReviewHub

## Authentication
- JWT access tokens: 15 min expiry
- Refresh tokens: 7 day expiry, httpOnly cookie
- Password: bcrypt, cost factor 12, minimum 8 chars
- Rate limit login: 5 attempts per 15 min per IP

## Data Protection
- Phone numbers: AES-256-GCM encrypted at rest
- Encryption key: from ENCRYPTION_KEY env var
- TLS 1.3 for all connections
- Never log: phone numbers, passwords, JWT tokens, API keys

## 152-ФЗ Compliance
- All data stored on Russian VPS
- SMS consent recorded with timestamp
- Opt-out link in every SMS
- Data deletion API available
- No data transfer outside Russia

## Input Validation
- All inputs validated with Zod schemas
- Parameterized queries only (Prisma ORM)
- HTML sanitization on review text
- File upload: CSV only, max 10MB, validate structure

## API Security
- CORS: whitelist admin and PWA domains only
- Helmet headers (CSP, X-Frame-Options, etc.)
- Rate limiting: 100 req/min (general), 10/min (public review endpoints)
- CSRF tokens on state-changing admin operations
