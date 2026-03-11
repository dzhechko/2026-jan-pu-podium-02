# Architecture: PWA Review Form

## System Diagram

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│ Customer     │────▶│  Fastify API │────▶│ PostgreSQL │
│ Mobile PWA   │     │              │     │ reviews    │
│ /review/:tok │     │ /api/reviews │     │ review_    │
│              │     │ /api/optout  │     │ requests   │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐
                    │ Reviews      │
                    │ Module       │
                    │ schema.ts    │
                    │ service.ts   │──▶ SentimentService
                    │ routes.ts    │
                    └──────────────┘

PWA Frontend (packages/pwa/):
┌──────────────────────────┐
│ React + React Router     │
│                          │
│ ReviewForm.tsx            │ ← Star rating, text input
│   └─ StarRating.tsx      │ ← Interactive star component
│ ThankYou.tsx             │ ← Yandex redirect or promo code
│ OptOut.tsx               │ ← Opt-out confirmation
└──────────────────────────┘
```

## Review Submission Flow

```
1. Customer opens /review/{token} from SMS
2. GET /api/reviews/form/{token} → company info
3. Customer fills form (stars + text)
4. POST /api/reviews/submit/{token}
   a. Validate token (exists, not expired, not reviewed)
   b. Create Review record
   c. Mark ReviewRequest → REVIEWED
   d. Run SentimentService.analyzeAndRoute()
   e. Return sentiment + redirect_url or promo_code
5. Navigate to /thank-you with result state
6. Show Yandex Maps button (positive) or promo code (negative)
```

## Opt-Out Flow

```
1. Customer clicks opt-out link: /optout/{token}
2. GET /api/optout/{token}
   a. Find ReviewRequest by token
   b. Mark client.opted_out = true
   c. Mark ReviewRequest → OPTED_OUT
   d. Cancel reminders (next_reminder_at = null)
3. Show confirmation message
```

## PWA Configuration

- manifest.json: standalone display, Russian locale
- Service worker: basic offline support (future)
- Tailwind CSS: mobile-first responsive design
- Vite proxy: /api → localhost:3000
