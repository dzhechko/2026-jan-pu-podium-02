# PRD: Admin Authentication (US-001)

## Overview
Registration and login system for ReviewHub admin panel with JWT-based authentication.

## User Stories
- **US-001**: As an admin, I can register with email/password/company/phone and receive JWT tokens
- **US-001a**: As an admin, I can log in and receive access + refresh tokens
- **US-001b**: As an admin, I can refresh my access token using a refresh token

## Acceptance Criteria
1. Registration creates admin record with bcrypt-hashed password (cost 12)
2. Login validates credentials and returns JWT pair
3. Access token expires in 15 minutes, refresh token in 7 days
4. Duplicate email returns 409
5. Invalid credentials return 401
6. Rate limiting: 5 attempts per 15 min per IP on auth endpoints
7. Password minimum 8 characters
8. Phone format: +7XXXXXXXXXX

## Out of Scope
- Password reset flow
- Email verification
- OAuth/social login
