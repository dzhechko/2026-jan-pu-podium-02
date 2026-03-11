# [INS-008] Settings channels: frontend expects object but API returns array

**Date:** 2026-03-11
**Status:** 🟢 Active
**Severity:** 🟡 Medium
**Tags:** `api`, `frontend`, `typescript`, `channels`, `settings`
**Hits:** 0

## Error Signatures
```
Не удалось получить имя бота
channels.telegram is undefined
```

## Symptoms
After entering a valid Telegram bot token in Settings, validation appears to fail with "Не удалось получить имя бота" even though the token is valid and the bot username was saved to DB.

## Diagnostic Steps
1. Confirmed Telegram API is reachable from server (`curl https://api.telegram.org/...`)
2. Checked API response: `channels` is returned as an array `[{type:'telegram', bot_username:'...'}]`
3. Checked frontend code: accesses `result.channels.telegram.bot_username` — treating channels as object
4. Also found: GET `/settings` didn't include channels data at all

## Root Cause
Two issues:
1. API `getChannels()` returns an array of `{type, configured, bot_username}` objects, but frontend `SettingsData` interface defines `channels` as `{telegram?: {...}, max?: {...}}` object
2. GET `/settings` endpoint didn't include channels in response — only PUT did

## Solution
1. Added `findChannel()` helper to parse array: `channels?.find(ch => ch.type === type)`
2. Updated all `result.channels.telegram.bot_username` → `findChannel(result.data.channels, 'telegram')?.bot_username`
3. Added channels to GET `/settings` response by calling `getChannels()` in `getSettings()`

## Prevention
- Define shared types between API and frontend (or generate from OpenAPI spec)
- When API returns collections, decide on array vs object format early and document it
- Integration test: save bot token → verify GET settings returns the bot username

## Related
- [INS-006](INS-006-fastify-delete-empty-json-body.md) — same debugging session
