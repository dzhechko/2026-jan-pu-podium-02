# Refinement: Admin Authentication

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Duplicate email registration | 409 with DUPLICATE_EMAIL code |
| 2 | Wrong password on login | 401 AUTH_FAILED (same message as missing email) |
| 3 | Non-existent email login | 401 AUTH_FAILED (don't reveal email existence) |
| 4 | Expired access token | 401 TOKEN_INVALID, client should refresh |
| 5 | Expired refresh token | 401 AUTH_FAILED, force re-login |
| 6 | Malformed JWT | 401 TOKEN_INVALID |
| 7 | Rate limit exceeded | 429 Too Many Requests |
| 8 | Empty password | 400 validation error (min 8 chars) |
| 9 | Invalid phone format | 400 validation error |
| 10 | SQL injection in email | Parameterized via Prisma, safe |

## Security Considerations

- **Timing attacks**: bcrypt.compare has constant-time comparison built-in
- **Token leakage**: tokens never logged (pino redaction recommended for production)
- **Brute force**: rate limit 5/15min prevents credential stuffing
- **Enumeration**: login returns same error for wrong email and wrong password

## Testing Strategy

### Unit Tests
- AuthService.register: valid input → tokens + admin
- AuthService.register: duplicate email → AuthError(409)
- AuthService.login: valid credentials → tokens
- AuthService.login: wrong password → AuthError(401)
- AuthService.refresh: valid token → new pair
- AuthService.refresh: expired token → AuthError(401)
- AuthService.verifyAccessToken: valid → payload
- AuthService.verifyAccessToken: expired → throws

### Integration Tests
- POST /api/auth/register → 201 with tokens
- POST /api/auth/register duplicate → 409
- POST /api/auth/login → 200 with tokens
- POST /api/auth/login wrong creds → 401
- POST /api/auth/refresh → 200 with new tokens
- Rate limit: 6th request in 15min → 429

## Performance Considerations

- bcrypt cost 12: ~250ms per hash (acceptable for auth)
- JWT verification: <1ms (HS256 is fast)
- DB lookup: indexed by email (unique), by id (PK)
