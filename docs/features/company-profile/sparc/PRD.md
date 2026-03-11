# PRD: Company Profile Setup (US-003)

## Overview
Admin can configure company settings: Yandex Maps URL, discount percentage/text, company name.

## User Stories
- **US-003**: As an admin, I can set my Yandex Maps organization URL so positive reviews redirect there
- **US-003a**: As an admin, I can configure discount percentage and text for negative review promo codes

## Acceptance Criteria
1. GET /api/settings returns current admin settings (authenticated)
2. PUT /api/settings updates company profile fields
3. Yandex Maps URL is validated and org_id extracted automatically
4. Discount percent: 1-100, default 10
5. All endpoints require JWT authentication
