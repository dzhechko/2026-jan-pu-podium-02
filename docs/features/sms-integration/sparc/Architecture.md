# Architecture: SMS Integration

## Component Diagram

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Admin Panel   │────▶│  Fastify API │────▶│ PostgreSQL │
│ Send SMS btn  │     │              │     │ review_    │
│               │     │ /api/review- │     │ requests   │
└──────────────┘     │ requests     │     │ sms_logs   │
                     └──────┬───────┘     └────────────┘
                            │
                     ┌──────┴───────┐     ┌─────────────┐
                     │ SMS Module   │────▶│ SMSC.ru API │
                     │              │     │ (external)  │
                     │ schema.ts    │     └─────────────┘
                     │ service.ts   │
                     │ routes.ts    │
                     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     │ SmscService  │
                     │ (wrapper)    │
                     │              │
                     │ Dev mode:    │
                     │ console.log  │
                     └──────────────┘
```

## Data Flow: Send Review Request

```
1. Admin selects clients → POST /api/review-requests { client_ids }
2. For each client:
   a. Check opted_out → skip if true
   b. Generate token (UUID without dashes)
   c. Create ReviewRequest (status: PENDING, expires: +30d)
   d. Decrypt client phone
   e. Build SMS message with PWA link + opt-out link
   f. Call SMSC.ru API
   g. On success: update status → SMS_SENT, set next_reminder
   h. Create SmsLog (SENT or FAILED)
3. Return { sent, failed }
```

## Database Schema

```sql
CREATE TABLE review_requests (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES admins(id),
  client_id UUID REFERENCES clients(id),
  token VARCHAR(64) UNIQUE,
  status VARCHAR(20) DEFAULT 'PENDING',
  reminder_count INT DEFAULT 0,
  sms_sent_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sms_logs (
  id UUID PRIMARY KEY,
  review_request_id UUID REFERENCES review_requests(id),
  phone_masked VARCHAR(20),  -- "+790****67"
  message_preview VARCHAR(100),
  smsc_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'QUEUED',
  reminder_number INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Dev Mode

When SMSC_LOGIN or SMSC_PASSWORD is empty, SmscService logs to console instead of making HTTP calls. Returns `{ success: true, messageId: "dev-{timestamp}" }`.
