# [INS-011] Docker Compose: environment section overrides env_file values with empty strings

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🟡 Medium
**Tags:** `docker-compose`, `config`, `deployment`
**Hits:** 0

## Error Signatures
```
ENCRYPTION_KEY must be at least 64 hex characters
WEBHOOK_SECRET must be at least 32 characters
Invalid environment variables
```

## Symptoms
API container crashes with env validation errors despite `.env.production` containing valid values. The `env_file` directive loads the file, but `environment:` section overrides specific vars with empty strings.

## Diagnostic Steps
1. `.env.production` has correct values for ENCRYPTION_KEY, WEBHOOK_SECRET
2. `env_file: .env.production` is present in docker-compose.yml
3. `environment:` section has `- ENCRYPTION_KEY=${ENCRYPTION_KEY}` — shell variable `$ENCRYPTION_KEY` is empty
4. Docker Compose: `environment:` takes precedence over `env_file`

## Root Cause
In `docker-compose.yml`, when both `env_file` and `environment` are used:
- `env_file` loads all vars from the file
- `environment` overrides any matching vars
- `${ENCRYPTION_KEY}` resolves from the **host shell**, not from `env_file`
- If the host shell doesn't have these vars exported, they become empty strings
- Empty strings override the values from `env_file`

## Solution
Remove vars from `environment:` that are already in `env_file`. Only put overrides and Docker-specific vars (DATABASE_URL, REDIS_URL with container hostnames) in `environment:`.

```yaml
services:
  api:
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db  # container hostname
      - REDIS_URL=redis://redis:6379  # container hostname
      # DON'T duplicate vars from .env.production here!
```

## Prevention
- Never use `${VAR}` in `environment:` for vars already in `env_file`
- Use `environment:` only for Docker-specific overrides (container hostnames, ports)
- Test with `docker compose config` to verify final env values before deploying

## Related
- [INS-009](INS-009-docker-monorepo-hoisted-deps.md) — Docker deployment issue
