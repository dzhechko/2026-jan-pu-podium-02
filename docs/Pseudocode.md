# Pseudocode: ReviewHub

## Data Structures

### Admin (Company)
```
type Admin = {
  id: UUID
  email: string
  password_hash: string
  company_name: string
  phone: string
  yandex_maps_url: string
  yandex_org_id: string
  discount_text: string
  discount_percent: number
  sms_templates: SMSTemplate[]
  created_at: Timestamp
}
```

### Client
```
type Client = {
  id: UUID
  admin_id: UUID (FK → Admin)
  name: string
  phone: string (encrypted)
  email: string? (encrypted)
  opted_out: boolean
  created_at: Timestamp
}
```

### ReviewRequest
```
type ReviewRequest = {
  id: UUID
  admin_id: UUID (FK → Admin)
  client_id: UUID (FK → Client)
  token: string (unique, for PWA link)
  status: enum(PENDING, SMS_SENT, REMINDED_1, REMINDED_2, REMINDED_3, REMINDED_4, REVIEWED, OPTED_OUT, EXPIRED)
  sms_sent_at: Timestamp?
  next_reminder_at: Timestamp?
  reminder_count: number (0-4)
  created_at: Timestamp
  expires_at: Timestamp (30 days)
}
```

### Review
```
type Review = {
  id: UUID
  review_request_id: UUID (FK → ReviewRequest)
  admin_id: UUID (FK → Admin)
  client_id: UUID (FK → Client)
  stars: number (1-5)
  text: string
  sentiment: enum(POSITIVE, NEGATIVE, NEUTRAL)
  sentiment_confidence: float (0-1)
  routed_to: enum(YANDEX_REDIRECT, INTERNAL_HIDDEN)
  promo_code: string?
  created_at: Timestamp
}
```

### SMSLog
```
type SMSLog = {
  id: UUID
  review_request_id: UUID (FK → ReviewRequest)
  phone: string
  message: string
  smsc_message_id: string?
  status: enum(QUEUED, SENT, DELIVERED, FAILED)
  reminder_number: number (0-4, 0=initial)
  sent_at: Timestamp
  delivered_at: Timestamp?
}
```

---

## Core Algorithms

### Algorithm: Send Review Request

```
FUNCTION sendReviewRequest(admin_id, client_ids[]):
  INPUT: admin_id (UUID), client_ids (UUID[])
  OUTPUT: { sent: number, failed: number }

  1. admin = DB.find(Admin, admin_id)
  2. sent = 0, failed = 0

  3. FOR EACH client_id IN client_ids:
     a. client = DB.find(Client, client_id)
     b. IF client.opted_out THEN SKIP, failed++

     c. token = generateSecureToken(32)
     d. pwa_link = "{BASE_URL}/review/{token}"

     e. review_request = DB.create(ReviewRequest, {
          admin_id, client_id, token,
          status: PENDING,
          reminder_count: 0,
          expires_at: NOW + 30 days
        })

     f. message = formatSMS(admin.sms_templates[0], {
          company: admin.company_name,
          discount: admin.discount_percent,
          link: pwa_link
        })

     g. result = SMSC.sendSMS(client.phone, message)

     h. IF result.success:
          DB.update(review_request, {
            status: SMS_SENT,
            sms_sent_at: NOW,
            next_reminder_at: NOW + 2 hours
          })
          DB.create(SMSLog, { ... status: SENT })
          sent++
        ELSE:
          DB.create(SMSLog, { ... status: FAILED })
          failed++

  4. RETURN { sent, failed }
```

### Algorithm: Cascade Reminder Engine

```
FUNCTION processReminders():
  INPUT: none (runs as cron job every 5 minutes)
  OUTPUT: number of reminders sent

  1. pending = DB.findAll(ReviewRequest, {
       next_reminder_at <= NOW,
       status NOT IN (REVIEWED, OPTED_OUT, EXPIRED),
       reminder_count < 4
     })

  2. FOR EACH request IN pending:
     a. IF request.expires_at < NOW:
          DB.update(request, { status: EXPIRED })
          CONTINUE

     b. client = DB.find(Client, request.client_id)
     c. admin = DB.find(Admin, request.admin_id)

     d. reminder_number = request.reminder_count + 1
     e. message = getTemplateForReminder(reminder_number, admin)
     f. pwa_link = "{BASE_URL}/review/{request.token}"
     g. message = formatSMS(message, { link: pwa_link, ... })

     h. result = SMSC.sendSMS(client.phone, message)

     i. next_delay = CASE reminder_number:
          1 → 22 hours    (total 24h from initial)
          2 → 2 days      (total 3 days)
          3 → 4 days      (total 7 days)
          4 → null         (no more)

     j. DB.update(request, {
          status: "REMINDED_{reminder_number}",
          reminder_count: reminder_number,
          next_reminder_at: next_delay ? NOW + next_delay : null
        })
     k. DB.create(SMSLog, { reminder_number, ... })

  3. RETURN pending.length
```

### Algorithm: Sentiment Analysis & Routing

```
FUNCTION analyzeAndRoute(review_id):
  INPUT: review_id (UUID)
  OUTPUT: { sentiment, confidence, routed_to }

  1. review = DB.find(Review, review_id)
  2. request = DB.find(ReviewRequest, review.review_request_id)
  3. admin = DB.find(Admin, review.admin_id)

  4. TRY:
       result = LLM.analyze({
         prompt: "Analyze sentiment of this review. Return JSON: {sentiment: 'positive'|'negative'|'neutral', confidence: 0.0-1.0}",
         text: review.text,
         language: "ru"
       })
       sentiment = result.sentiment
       confidence = result.confidence
     CATCH LLMError:
       // Fallback: use star rating
       sentiment = review.stars >= 4 ? "positive" : "negative"
       confidence = 0.5
       LOG.warn("LLM fallback used for review", review_id)

  5. // Routing decision
     IF sentiment == "positive" AND confidence >= 0.7:
       routed_to = YANDEX_REDIRECT
     ELSE IF sentiment == "positive" AND confidence < 0.7:
       // Low confidence positive: use stars as tiebreaker
       routed_to = review.stars >= 4 ? YANDEX_REDIRECT : INTERNAL_HIDDEN
     ELSE:
       routed_to = INTERNAL_HIDDEN

  6. // Generate promo code for all reviews
     promo_code = generatePromoCode(admin.id)

  7. DB.update(review, { sentiment, sentiment_confidence: confidence, routed_to, promo_code })
  8. DB.update(request, { status: REVIEWED, next_reminder_at: null })

  9. RETURN { sentiment, confidence, routed_to, promo_code }
```

### Algorithm: PWA Review Submission

```
FUNCTION submitReview(token, stars, text):
  INPUT: token (string), stars (1-5), text (string)
  OUTPUT: { success, sentiment, redirect_url?, promo_code }

  1. request = DB.find(ReviewRequest, { token })
  2. IF NOT request THEN RETURN { error: "Invalid link" }
  3. IF request.expires_at < NOW THEN RETURN { error: "Link expired" }
  4. IF request.status == REVIEWED THEN RETURN { error: "Already reviewed" }

  5. // Sanitize input
  6. text = sanitizeHTML(text)
  7. IF text.length > 2000 THEN text = text.substring(0, 2000)

  8. review = DB.create(Review, {
       review_request_id: request.id,
       admin_id: request.admin_id,
       client_id: request.client_id,
       stars, text
     })

  9. // Async sentiment analysis
  10. result = analyzeAndRoute(review.id)

  11. IF result.routed_to == YANDEX_REDIRECT:
        admin = DB.find(Admin, request.admin_id)
        redirect_url = "https://yandex.ru/maps/org/{admin.yandex_org_id}/reviews/"
        RETURN { success: true, sentiment: "positive", redirect_url, promo_code: result.promo_code }
      ELSE:
        RETURN { success: true, sentiment: "negative", promo_code: result.promo_code }
```

---

## API Contracts

### Auth

```
POST /api/auth/register
  Body: { email, password, company_name, phone }
  Response 201: { token, refresh_token, admin: { id, email, company_name } }
  Response 400: { error: { code: "VALIDATION", message } }
  Response 409: { error: { code: "DUPLICATE_EMAIL", message } }

POST /api/auth/login
  Body: { email, password }
  Response 200: { token, refresh_token, admin }
  Response 401: { error: { code: "AUTH_FAILED", message } }

POST /api/auth/refresh
  Body: { refresh_token }
  Response 200: { token, refresh_token }
```

### Clients

```
GET /api/clients
  Headers: { Authorization: Bearer <token> }
  Query: { page, limit, search? }
  Response 200: { data: Client[], meta: { total, page, limit } }

POST /api/clients
  Body: { name, phone, email? }
  Response 201: { data: Client }

POST /api/clients/import
  Body: multipart/form-data { file: CSV }
  Response 200: { imported: number, skipped: number, errors: [] }

DELETE /api/clients/:id
  Response 204
```

### Review Requests

```
POST /api/review-requests
  Body: { client_ids: UUID[] }
  Response 200: { sent: number, failed: number }

GET /api/review-requests
  Query: { page, limit, status? }
  Response 200: { data: ReviewRequest[], meta }
```

### Reviews (PWA - public)

```
GET /api/reviews/form/:token
  Response 200: { company_name, discount_text, discount_percent }
  Response 404: { error: "Invalid or expired link" }

POST /api/reviews/submit/:token
  Body: { stars: 1-5, text: string }
  Response 200: { sentiment, redirect_url?, promo_code }
  Response 400: { error: "Validation error" }
  Response 404: { error: "Invalid link" }
  Response 410: { error: "Link expired" }
```

### Reviews (Admin)

```
GET /api/reviews
  Headers: { Authorization: Bearer <token> }
  Query: { page, limit, sentiment?, date_from?, date_to? }
  Response 200: { data: Review[], meta }
```

### Analytics

```
GET /api/analytics/dashboard
  Headers: { Authorization: Bearer <token> }
  Query: { period: "7d"|"30d"|"90d" }
  Response 200: {
    total_sms_sent: number,
    total_reviews: number,
    conversion_rate: number,
    positive_count: number,
    negative_count: number,
    avg_rating: number,
    reviews_by_day: [{ date, count }]
  }
```

### Company Settings

```
GET /api/settings
PUT /api/settings
  Body: { company_name?, yandex_maps_url?, discount_percent?, discount_text?, sms_templates? }
  Response 200: { data: AdminSettings }
```

---

## State Transitions

### ReviewRequest States

```
PENDING → SMS_SENT → REMINDED_1 → REMINDED_2 → REMINDED_3 → REMINDED_4
   ↓         ↓           ↓            ↓            ↓            ↓
   └─────────┴───────────┴────────────┴────────────┴────────────┴──→ REVIEWED
   └─────────┴───────────┴────────────┴────────────┴────────────┴──→ OPTED_OUT
   └─────────┴───────────┴────────────┴────────────┴────────────┴──→ EXPIRED
```

---

## Error Handling Strategy

| Category | Errors | Handling |
|----------|--------|----------|
| SMS Delivery | SMSC timeout, invalid phone | Retry 3x with backoff, then mark FAILED |
| LLM API | Timeout, rate limit, error | Fallback to star-based routing |
| Auth | Invalid token, expired | Return 401, client refreshes token |
| Validation | Bad input | Return 400 with field-level errors |
| Rate Limit | Too many requests | Return 429, backoff header |
| Server Error | Unhandled | Return 500, log to monitoring |
