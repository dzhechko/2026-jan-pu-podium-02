# PRD: SMS Integration (US-004, US-010)

## Overview
SMSC.ru API integration for sending review request SMS. Admin sends SMS to selected clients with PWA review link. Delivery tracking via SMSC.ru status API.

## User Stories
- **US-004**: As an admin, I can send review request SMS to selected clients
- **US-010**: As an admin, I can see SMS delivery status

## Acceptance Criteria
1. POST /api/review-requests creates review requests and sends SMS
2. SMS contains PWA link with unique token per client
3. Opted-out clients are skipped
4. SMS includes opt-out link
5. SMSC.ru API called with login/password/phone/message
6. SmsLog records created for each send attempt
7. ReviewRequest status updated to SMS_SENT on success
8. GET /api/review-requests returns paginated list with status
