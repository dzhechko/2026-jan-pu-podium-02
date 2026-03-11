---
description: Bootstrap ReviewHub project from SPARC documentation
---

# /start

## Steps

1. **Read Architecture:** `docs/Architecture.md` — tech stack, DB schema, monorepo structure
2. **Initialize Monorepo:**
   - Create `packages/api/`, `packages/admin/`, `packages/pwa/`
   - Root `package.json` with npm workspaces
3. **Setup Backend (packages/api/):**
   - `npm init`, install Fastify, Prisma, Zod, jose, bcrypt
   - Create `prisma/schema.prisma` from Architecture.md DB schema
   - Run `npx prisma migrate dev --name init`
   - Create module structure: auth, clients, reviews, sms, sentiment, analytics
4. **Setup Admin Panel (packages/admin/):**
   - `npm create vite@latest . -- --template react-ts`
   - Install shadcn/ui, react-router, tanstack-query
5. **Setup PWA (packages/pwa/):**
   - `npm create vite@latest . -- --template react-ts`
   - Add PWA manifest and service worker
6. **Docker:**
   - Create `docker-compose.yml` from Architecture.md
   - Create `Dockerfile` (multi-stage build)
   - Create `nginx/nginx.conf`
7. **Config:**
   - Create `.env.example`
   - Create `.gitignore`
8. **Verify:**
   - `docker compose up -d`
   - Health check: `curl localhost:3000/api/health`

## Recommended First Feature

After bootstrap, implement: **Admin Auth (US-001)** — registration + login with JWT.
See `docs/Pseudocode.md` for auth algorithms and `docs/Specification.md` for acceptance criteria.
