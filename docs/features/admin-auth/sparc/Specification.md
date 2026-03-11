# Specification: Admin Authentication

## API Endpoints

### POST /api/auth/register
- **Input**: `{ email, password, company_name, phone }`
- **Output 201**: `{ token, refresh_token, admin: { id, email, company_name } }`
- **Output 400**: Validation error
- **Output 409**: Duplicate email

### POST /api/auth/login
- **Input**: `{ email, password }`
- **Output 200**: `{ token, refresh_token, admin: { id, email, company_name } }`
- **Output 401**: Invalid credentials

### POST /api/auth/refresh
- **Input**: `{ refresh_token }`
- **Output 200**: `{ token, refresh_token }`
- **Output 401**: Invalid refresh token

## Security
- Passwords: bcrypt, cost factor 12
- JWT: HS256, access 15min, refresh 7d
- Rate limiting: 5 req / 15 min on auth endpoints
- No token/password logging

## Validation Rules
- email: valid email format
- password: min 8 chars
- company_name: min 1 char
- phone: regex `^\+7\d{10}$`
