# Coding Style: ReviewHub

## TypeScript
- Strict mode enabled
- No `any` types — use proper types or `unknown`
- Interface over type for object shapes
- Enums for fixed sets (sentiment, status, etc.)

## Backend (Fastify)
- Module pattern: each feature in `src/modules/{name}/`
- Module structure: `routes.ts`, `service.ts`, `schema.ts`
- Validation: Zod schemas in `schema.ts`
- Error handling: Fastify error handler + custom error classes
- Logging: Fastify built-in logger (pino), structured JSON

## Frontend (React)
- Functional components only
- Custom hooks for shared logic
- React Query for server state
- Shadcn/ui components (Tailwind CSS)
- File naming: `kebab-case.tsx` for components

## Database
- Prisma schema as source of truth
- Migrations for all schema changes
- Never raw SQL — use Prisma client
- UUID for primary keys

## Git
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Feature branches from `main`
- Squash merge to `main`

## Environment
- All config via env vars (no hardcoded values)
- `.env.example` kept in sync
- Secrets: never committed, never logged
