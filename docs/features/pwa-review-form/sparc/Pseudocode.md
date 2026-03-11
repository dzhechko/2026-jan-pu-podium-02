# Pseudocode: PWA Review Form

## Backend: Review Module
```
packages/api/src/modules/reviews/
├── schema.ts    — Zod validation
├── service.ts   — ReviewService (form load, submit, opt-out)
└── routes.ts    — Public endpoints (no auth)
```

## GET /api/reviews/form/:token
```
FUNCTION getReviewForm(token):
  1. Find ReviewRequest by token
  2. If not found → 404
  3. If expired (expires_at < now) → 410
  4. If already reviewed → 410
  5. Load admin settings (company_name, discount_text, discount_percent)
  6. Return { company_name, discount_text, discount_percent }
```

## POST /api/reviews/submit/:token
```
FUNCTION submitReview(token, { stars, text }):
  1. Find ReviewRequest by token (validate not expired/reviewed)
  2. Create Review record (stars, text)
  3. Update ReviewRequest status → REVIEWED
  4. Cancel future reminders (next_reminder_at = null)
  5. Trigger sentiment analysis (async or inline)
  6. If positive: generate Yandex redirect URL
  7. If negative: generate promo code
  8. Return { sentiment, redirect_url?, promo_code? }
```

## GET /api/optout/:token
```
FUNCTION optOut(token):
  1. Find ReviewRequest by token
  2. Mark client as opted_out
  3. Update ReviewRequest status → OPTED_OUT
  4. Return success message
```

## PWA Frontend
```
packages/pwa/src/
├── App.tsx          — Router
├── pages/
│   ├── ReviewForm.tsx   — Star rating + text form
│   ├── ThankYou.tsx     — Post-submit (redirect or promo)
│   ├── OptOut.tsx       — Opt-out confirmation
│   └── NotFound.tsx     — Invalid/expired token
└── components/
    └── StarRating.tsx   — Interactive star component
```
