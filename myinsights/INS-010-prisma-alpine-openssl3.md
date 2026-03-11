# [INS-010] Prisma on Alpine: libssl.so.1.1 missing — needs binaryTargets + openssl

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🔴 Critical
**Tags:** `docker`, `prisma`, `alpine`, `openssl`, `deployment`
**Hits:** 0

## Error Signatures
```
libssl.so.1.1: No such file or directory
libquery_engine-linux-musl.so.node
Prisma failed to detect the libssl/openssl version
Defaulting to "openssl-1.1.x"
Unable to require(`/app/node_modules/.prisma/client/libquery_engine-linux-musl.so.node`)
```

## Symptoms
API container starts but crashes immediately with Prisma error: cannot load `libquery_engine-linux-musl.so.node` because `libssl.so.1.1` is missing. Alpine 3.23+ ships only OpenSSL 3.x.

## Diagnostic Steps
1. Error clearly states `libssl.so.1.1` missing
2. Checked Alpine packages — `openssl1.1-compat` doesn't exist in Alpine 3.23
3. Tried `apk add openssl` — installs OpenSSL 3.x but Prisma defaults to 1.1 engine
4. Found Prisma warning: "failed to detect the libssl/openssl version, defaulting to openssl-1.1.x"
5. Both engine binaries existed: `libquery_engine-linux-musl.so.node` AND `libquery_engine-linux-musl-openssl-3.0.x.so.node`

## Root Cause
Two issues combined:
1. Prisma schema had no `binaryTargets` — only generated the default (OpenSSL 1.1) engine
2. Even after adding `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`, Prisma couldn't detect the system OpenSSL version because `openssl` package wasn't installed in the runtime Alpine image

## Solution
Both changes required:

1. In `prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

2. In Dockerfile runtime stage:
```dockerfile
FROM base AS api
RUN apk add --no-cache openssl
```

## Prevention
- Always set `binaryTargets` in Prisma schema when deploying to Docker
- For Alpine: use `linux-musl-openssl-3.0.x` (Alpine 3.17+)
- For Debian: use `linux-arm64-openssl-3.0.x` or `debian-openssl-3.0.x`
- Install `openssl` in runtime image so Prisma can detect the version
- Test Docker build locally before deploying

## Related
- [INS-009](INS-009-docker-monorepo-hoisted-deps.md) — another Docker dependency issue
