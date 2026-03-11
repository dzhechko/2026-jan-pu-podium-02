# Development Insights Index

Living knowledge base. **Read this file first** — then load specific detail files as needed.

> **For Claude Code:** When you encounter an error, `grep` the Error Signatures column below.
> If you find a match, read ONLY the linked detail file — don't load everything.

| ID | Error Signatures | Summary | Status | Hits | File |
|----|-----------------|---------|--------|------|------|
| INS-001 | `P0 mandatory items`, `16 items`, `toolkit incomplete`, `missing commands` | cc-toolkit-generator Phase 3 generates only 6/16 P0 items under autonomous execution | 🟢 Active | 1 | [INS-001-toolkit-p0-items-skipped.md](INS-001-toolkit-p0-items-skipped.md) |
| INS-002 | `SPARC docs incomplete`, `missing Architecture.md`, `missing Refinement.md`, `only 2 docs`, `only 3 docs`, `INS-007 violation`, `SPARC Completeness Gate FAILED` | /run mvp generates only 2-3 of 5 required SPARC docs per feature — FIXED: added SPARC Completeness Gate to /feature, /go, /run, feature-lifecycle.md. Upstream fix needed in cc-toolkit-generator-enhanced | 🟢 Active | 2 | [INS-002-sparc-docs-incomplete-per-feature.md](INS-002-sparc-docs-incomplete-per-feature.md) |
| INS-003 | `XHR POST /api/auth/register`, `ECONNREFUSED 127.0.0.1:3000`, `Vite proxy`, `connection refused` | Vite proxy in admin & PWA hardcodes port 3000 — if API runs on different port, all /api/* requests fail silently | 🟢 Active | 1 | [INS-003-vite-proxy-port-mismatch.md](INS-003-vite-proxy-port-mismatch.md) |
| INS-004 | `Отправлено: 1, Ошибок: 0`, `[SMSC DEV]`, `SMS not received`, `smsc console empty` | SMSC dev-mode guard returns success:true without sending — admin sees "sent" but nothing delivered | 🟢 Active | 1 | [INS-004-smsc-dev-mode-bypass.md](INS-004-smsc-dev-mode-bypass.md) |
| INS-005 | `localhost` in SMS, `PWA_URL=http://localhost`, `review link unreachable` | SMS contains localhost URLs instead of public IP — links unreachable from customer phones | 🟢 Active | 1 | [INS-005-pwa-url-localhost-in-sms.md](INS-005-pwa-url-localhost-in-sms.md) |
