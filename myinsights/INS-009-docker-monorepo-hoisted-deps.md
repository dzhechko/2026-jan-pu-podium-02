# [INS-009] Docker monorepo: npm workspace non-hoisted dependencies missing in runtime

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🔴 Critical
**Tags:** `docker`, `monorepo`, `npm-workspaces`, `deployment`
**Hits:** 0

## Error Signatures
```
ERR_MODULE_NOT_FOUND
Cannot find package '@fastify/multipart'
Cannot find package
```

## Symptoms
API container crashes on startup with `ERR_MODULE_NOT_FOUND` for `@fastify/multipart` despite it being listed in `packages/api/package.json` and `npm ci` completing successfully in the build stage.

## Diagnostic Steps
1. Checked `package.json` — dependency is listed
2. Checked `package-lock.json` — package resolved under `packages/api/node_modules/@fastify/multipart` (NOT hoisted to root)
3. Inspected Docker image — `ls /app/node_modules/@fastify/` showed multipart missing
4. Root cause: npm workspaces don't always hoist packages to root `node_modules/` (dependency conflicts prevent hoisting)

## Root Cause
In npm workspaces, some packages are installed in `packages/<pkg>/node_modules/` instead of the root `node_modules/`. The Dockerfile only copied root `/app/node_modules` to the runtime stage, missing workspace-local dependencies.

Node.js module resolution starts from the script directory (`/app/dist/app.js`) and walks up to `/app/node_modules/`, but never checks `packages/api/node_modules/`.

## Solution
1. Add a second COPY layer in Dockerfile to merge workspace-local node_modules into root:
```dockerfile
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/api/node_modules ./node_modules
```
Docker COPY merges directory contents, so non-hoisted packages get added to root node_modules.

2. Verify with: `docker run --rm <image> ls /app/node_modules/@fastify/`

## Prevention
- Always check `package-lock.json` for packages under `packages/*/node_modules/` — these won't be in root
- In Dockerfile for monorepo API runtime, always include both root and workspace-local node_modules
- After Docker build, verify critical dependencies exist in the image before deploying

## Related
- [INS-010](INS-010-prisma-alpine-openssl3.md) — another Docker runtime issue (OpenSSL)
