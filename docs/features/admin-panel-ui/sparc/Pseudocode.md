# Pseudocode: Admin Panel UI

## Structure
```
packages/admin/src/
├── main.tsx
├── App.tsx              — Router + AuthProvider + QueryClient
├── lib/
│   └── api.ts           — Fetch wrapper with JWT
├── hooks/
│   └── use-auth.ts      — Auth context + token management
├── components/
│   └── Layout.tsx        — Sidebar + content
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── Clients.tsx
│   ├── Reviews.tsx
│   └── Settings.tsx
```

## Auth Flow
```
1. User submits login form
2. POST /api/auth/login → receive token + refresh_token
3. Store tokens in localStorage
4. Attach token to all API requests via Authorization header
5. On 401 response → try refresh → if fails → redirect to login
```

## API Client
```
FUNCTION apiClient(path, options):
  1. Get token from localStorage
  2. Add Authorization: Bearer {token} header
  3. Fetch API
  4. If 401 → attempt token refresh
  5. If refresh fails → clear tokens, redirect to login
  6. Return response data
```
