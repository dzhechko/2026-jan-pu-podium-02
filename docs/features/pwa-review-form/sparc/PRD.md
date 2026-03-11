# PRD: PWA Review Form (US-014, US-015, US-016)

## Overview
Mobile-first PWA form for customers to submit reviews. Accessed via unique token link from SMS. Shows company branding, star rating, text input. After submission: sentiment analysis routes to Yandex Maps (positive) or shows promo code (negative).

## User Stories
- **US-014**: As a customer, I can open a review link from SMS and see a branded form
- **US-015**: As a customer, I can rate 1-5 stars and write review text
- **US-016**: As a customer, I receive a discount promo code after submitting

## API Endpoints (public, no auth)
- GET /api/reviews/form/:token — load form data (company name, discount info)
- POST /api/reviews/submit/:token — submit review (stars, text)
- GET /api/optout/:token — opt-out from SMS

## Acceptance Criteria
1. Form loads with company name and branding
2. Star rating 1-5 (required)
3. Text field (required, min 10 chars)
4. Expired/invalid tokens show error page
5. After submit: show redirect URL or promo code based on sentiment
6. Opt-out link unsubscribes client from future SMS
