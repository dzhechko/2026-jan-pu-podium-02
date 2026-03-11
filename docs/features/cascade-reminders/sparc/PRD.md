# PRD: Cascade Reminders

## Overview
Automated 4-step SMS reminder cascade (2h → 24h → 3d → 7d) to increase review conversion rates. Reminders stop when client submits a review or opts out.

## User Stories
- **US-011:** System runs cascade reminders (2h, 24h, 3d, 7d)
- **US-012:** System stops reminders after review received

## Requirements
1. Cron job runs every 5 minutes checking for pending reminders
2. Maximum 4 reminders per review request
3. Cancellation on: review submitted, client opted out, link expired
4. Each reminder logged in sms_logs with reminder_number
5. Opt-out link in every SMS (152-ФЗ)
6. Phone decrypted only at send time, never logged

## Success Metrics
- SMS→review conversion increase from 15% to 25%
- No SMS sent after opt-out or review
- Zero unencrypted phone leaks in logs
