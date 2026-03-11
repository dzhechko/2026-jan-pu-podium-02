# Architecture: Admin Panel UI

## Component Tree

```
main.tsx
└── React.StrictMode
    └── QueryClientProvider
        └── BrowserRouter
            └── App.tsx
                └── AuthContext.Provider
                    ├── /login → Login
                    ├── /register → Register
                    └── Layout (auth required)
                        ├── Sidebar (nav + logout)
                        └── Outlet
                            ├── Dashboard
                            ├── Clients
                            ├── Reviews
                            └── Settings
```

## State Management

| State | Storage | Purpose |
|-------|---------|---------|
| Auth tokens | localStorage | JWT access + refresh |
| Admin info | localStorage + React state | User display |
| Server data | TanStack Query cache | API responses |
| Form state | React useState | Local form inputs |

## API Client Architecture

```typescript
apiClient<T>(path, options) → Promise<T>
  ├── Add Bearer token from localStorage
  ├── Fetch API
  ├── On 401: try refresh → retry
  │   └── On refresh fail: clear auth → redirect /login
  └── Parse JSON response
```

## Build Configuration

- Vite: port 5173
- Proxy: /api → localhost:3000
- Tailwind CSS: utility-first styling
- TanStack Query: staleTime 5min, retry 1

## Dependencies

| Package | Purpose |
|---------|---------|
| react-router-dom | Client-side routing |
| @tanstack/react-query | Server state + caching |
| tailwindcss | Utility CSS |
| lucide-react | Icons (planned) |
