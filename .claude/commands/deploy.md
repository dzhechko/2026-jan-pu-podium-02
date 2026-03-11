---
description: Deploy ReviewHub to VPS environment
---

# /deploy $ARGUMENTS

## Environments

| Env | Host | Branch |
|-----|------|--------|
| staging | staging.reviewhub.ru | develop |
| production | reviewhub.ru | main |

## Deploy Steps

1. **Pre-deploy checks:**
   - All tests pass
   - No critical npm audit issues
   - Environment variables configured
   - Database backup taken

2. **Build:**
   ```bash
   docker compose build
   ```

3. **Deploy:**
   ```bash
   ssh user@{host} "cd /opt/reviewhub && git pull && docker compose build && docker compose up -d"
   docker compose exec -T api npx prisma migrate deploy
   ```

4. **Verify:**
   - Health check: `curl https://{host}/api/health`
   - Check logs: `docker compose logs -f api --tail 50`
   - Monitor error rate for 15 minutes

5. **Rollback (if needed):**
   ```bash
   ssh user@{host} "cd /opt/reviewhub && git checkout {previous-tag} && docker compose up -d"
   ```

## Checklist
See `docs/Completion.md` for full pre-deployment checklist.
