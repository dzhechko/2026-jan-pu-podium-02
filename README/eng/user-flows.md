# ReviewHub User & Admin Flows

## Admin Flows

### Flow 1: Initial Setup

```
Admin                          System
  │                               │
  ├─ Opens /register ────────────▶│
  │                               │
  ├─ Fills: email, password,     │
  │  company, phone ─────────────▶│
  │                               ├─ Creates account
  │                               ├─ Generates JWT
  │◀── Redirect to / ────────────┤
  │                               │
  ├─ Navigates to /settings ─────▶│
  │                               │
  ├─ Enters Yandex Maps URL ────▶│
  │                               ├─ Extracts org_id
  ├─ Sets discount to 15% ──────▶│
  │                               ├─ Saves settings
  │◀── "Saved" ──────────────────┤
  │                               │
```

### Flow 2: Adding Clients & Sending SMS

```
Admin                          System
  │                               │
  ├─ Opens /clients ─────────────▶│
  │                               │
  ├─ Clicks "Add Client" ───────▶│
  ├─ Name: Ivan, Tel: +790... ──▶│
  │                               ├─ Encrypts phone (AES-256)
  │                               ├─ Saves to DB
  │◀── Client added ─────────────┤
  │                               │
  ├─ Clicks "SMS" for Ivan ─────▶│
  │                               ├─ Creates review_request
  │                               ├─ Generates unique token
  │                               ├─ Decrypts phone
  │                               ├─ Sends SMS via SMSC.ru
  │                               ├─ Creates sms_log
  │◀── "SMS sent" ───────────────┤
  │                               │
```

### Flow 3: CSV Import

```
Admin                          System
  │                               │
  ├─ Clicks "Import CSV" ───────▶│
  ├─ Uploads file (≤10 MB) ────▶│
  │                               ├─ Parses CSV
  │                               ├─ For each row:
  │                               │   ├─ Validate phone
  │                               │   ├─ Encrypt
  │                               │   └─ Insert to DB
  │◀── Imported: 48 ─────────────┤
  │    Skipped: 2 (duplicates)    │
  │    Errors: 1 (invalid phone)  │
  │                               │
```

### Flow 4: Viewing Analytics

```
Admin                          System
  │                               │
  ├─ Opens / (dashboard) ───────▶│
  │                               ├─ 6 queries in parallel:
  │                               │   ├─ COUNT(sms_logs)
  │                               │   ├─ COUNT(reviews)
  │                               │   ├─ COUNT(positive)
  │                               │   ├─ COUNT(negative)
  │                               │   ├─ AVG(stars)
  │                               │   └─ GROUP BY date
  │◀── Dashboard with metrics ───┤
  │                               │
  ├─ Selects "7 days" period ───▶│
  │                               ├─ Recalculates for 7 days
  │◀── Updated data ─────────────┤
  │                               │
```

## Customer Flows

### Flow 5: Submitting a Positive Review

```
Customer                       System
  │                               │
  │◀── SMS: "Leave a review" ────┤
  │                               │
  ├─ Opens link ─────────────────▶│
  │                               ├─ GET /api/reviews/form/:token
  │                               ├─ Validates: token valid?
  │                               │   not expired? not used?
  │◀── Form: company, discount ──┤
  │                               │
  ├─ Rates 5 stars ──────────────▶│
  ├─ Writes "Great!" ───────────▶│
  ├─ Clicks "Submit" ───────────▶│
  │                               ├─ POST /api/reviews/submit/:token
  │                               ├─ Saves review
  │                               ├─ Claude API → sentiment: POSITIVE
  │                               ├─ confidence: 0.95 (≥ 0.7)
  │                               ├─ routed_to: YANDEX_REDIRECT
  │                               ├─ Status → REVIEWED
  │◀── redirect_url for Yandex ──┤
  │                               │
  ├─ Clicks "Open Yandex" ──────▶│ (external link)
  │                               │
```

### Flow 6: Submitting a Negative Review

```
Customer                       System
  │                               │
  ├─ Opens link ─────────────────▶│
  │◀── Form ─────────────────────┤
  │                               │
  ├─ Rates 2 stars ──────────────▶│
  ├─ Writes "Long wait" ────────▶│
  ├─ Clicks "Submit" ───────────▶│
  │                               ├─ Claude API → sentiment: NEGATIVE
  │                               ├─ routed_to: INTERNAL_HIDDEN
  │                               ├─ Generates promo code RH-XXXXXXXX
  │                               ├─ Status → REVIEWED
  │◀── promo_code + discount_text ┤
  │                               │
  │  "Thank you! Your promo code: │
  │   RH-A1B2C3D4, 15% off"      │
  │                               │
```

### Flow 7: Opt-Out

```
Customer                       System
  │                               │
  ├─ Clicks "Unsubscribe" ──────▶│
  │                               ├─ GET /api/optout/:token
  │                               ├─ client.opted_out = true
  │                               ├─ review_request → OPTED_OUT
  │                               ├─ next_reminder_at = null
  │◀── "You are unsubscribed" ───┤
  │                               │
```

### Flow 8: Expired Link

```
Customer                       System
  │                               │
  ├─ Opens old link ─────────────▶│
  │                               ├─ GET /api/reviews/form/:token
  │                               ├─ Checks expires_at < NOW
  │◀── 410: "Link expired" ──────┤
  │                               │
```

## System Flows

### Flow 9: Cascade Reminders (v1.0)

```
System                         Timeline
  │                               │
  ├─ SMS sent ────────────────── T+0
  │                               │
  ├─ No review? ──────────────── T+2h
  │   └─ Reminder #1             │
  │                               │
  ├─ No review? ──────────────── T+24h
  │   └─ Reminder #2             │
  │                               │
  ├─ No review? ──────────────── T+3d
  │   └─ Reminder #3             │
  │                               │
  ├─ No review? ──────────────── T+7d
  │   └─ Reminder #4 (final)     │
  │                               │
  ├─ No more SMS ─────────────────┤
  │                               │
```

### Flow 10: LLM Fallback

```
System
  │
  ├─ Review received
  ├─ Claude API → error/timeout
  ├─ Fallback: use star rating
  │   ├─ ≥ 4 stars → POSITIVE
  │   └─ < 4 stars → NEGATIVE
  ├─ confidence = 0.5 (fallback)
  ├─ Log API error
  │
```

### Flow 11: Messenger Auto-Linking (v1.0)

```
Client                         System
  │                               │
  │◀── SMS: "...Telegram:        │
  │    t.me/bot?start={id}" ─────┤
  │                               │
  ├─ Taps Telegram link ────────▶│ (opens t.me/bot)
  │                               │
  ├─ Taps "Start" ──────────────▶│
  │                               ├─ Telegram → /start {clientId}
  │                               ├─ Webhook POST /api/webhooks/telegram/:adminId
  │                               ├─ HMAC verification ✓
  │                               ├─ UUID validation ✓
  │                               ├─ Encrypts chat_id (AES-256)
  │                               ├─ preferred_channel → telegram
  │◀── "You're connected!" ──────┤
  │                               │
  │  Future notifications ───────▶│ via Telegram (free)
  │                               │
```

### Flow 12: Batch Send (v1.1)

```
Admin                          System
  │                               │
  ├─ Selects 25 clients ─────────▶│
  ├─ Picks channel "Telegram" ──▶│
  ├─ Clicks "Send" ─────────────▶│
  │                               ├─ For each client:
  │                               │   ├─ Telegram → send
  │                               │   ├─ If error → fallback SMS
  │                               │   └─ Log to sms_logs
  │◀── Sent: 23, Failed: 2 ──────┤
  │                               │
```

### Flow 13: Messenger Fallback to SMS

```
System
  │
  ├─ Send via Telegram
  ├─ Telegram API → error (bot blocked)
  ├─ Fallback: send via SMS
  │   ├─ Logged: telegram → failed
  │   ├─ SMS via SMSC.ru → success
  │   └─ actual_channel = sms, fallback_from = telegram
  ├─ review_request.channel = sms (updated)
  │
```
