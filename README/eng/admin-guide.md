# ReviewHub Admin Guide

## Getting Started

### Registration

1. Open `https://admin.reviewhub.ru/register`
2. Fill in:
   - **Email** — work email
   - **Password** — minimum 8 characters
   - **Company name** — displayed to customers in the review form
   - **Phone** — format +7XXXXXXXXXX
3. Click "Register"

### Login

1. Open `https://admin.reviewhub.ru/login`
2. Enter email and password
3. Session lasts 7 days (automatic token refresh)

## Company Profile Setup

**Page:** Settings (`/settings`)

| Field | Description | Required |
|-------|-------------|:--------:|
| Company name | Shown to customers in PWA | Yes |
| Yandex Maps link | Your organization's Yandex Maps URL | Yes |
| Discount (%) | Discount for negative reviews | No (default 10%) |
| Discount text | Promo offer description | No |

### How to Find Your Yandex Maps Link

1. Open [Yandex Maps](https://yandex.ru/maps)
2. Search for your organization
3. Copy URL from the address bar
4. Format: `https://yandex.ru/maps/org/name/123456789/`

## Client Management

**Page:** Clients (`/clients`)

### Add Client Manually

1. Click "Add Client"
2. Enter name and phone (+7XXXXXXXXXX)
3. Email is optional

### CSV Import

1. Prepare a CSV file (max 10 MB):
   ```csv
   name,phone,email
   Ivan Petrov,+79001234567,ivan@mail.ru
   Maria Sidorova,+79009876543,
   ```
2. Click "Import CSV"
3. Select file
4. System will report: imported / skipped / errors

### Delete Client

Click the delete icon next to the client. Deletion is irreversible — all associated requests and reviews are also deleted.

## Sending Review Requests

### Single Send

1. On the "Clients" page, find the desired client
2. Click "Send SMS"
3. Client receives an SMS with a link to the review form

### What the Client Receives

SMS message:
```
{Company Name} asks for a review: https://review.reviewhub.ru/review/{token}
Unsubscribe: https://review.reviewhub.ru/optout/{token}
```

## Viewing Reviews

**Page:** Reviews (`/reviews`)

Each review contains:
- Rating (1-5 stars)
- Review text
- Sentiment (positive / negative / neutral)
- Route (Yandex Maps / hidden)
- Promo code (if negative)

### Filters
- All reviews
- Positive only
- Negative only

## Analytics

**Page:** Dashboard (`/`)

### Metrics

| Metric | Description |
|--------|-------------|
| SMS sent | Number of SMS sent in the period |
| Reviews | Number of reviews received |
| Conversion | Reviews / SMS (%) |
| Avg rating | Average score (1-5) |
| Positive | Number of positive reviews |
| Negative | Number of negative reviews |

### Periods
- 7 days
- 30 days (default)
- 90 days

### Chart
Reviews per day bar chart for the selected period.

## Review Routing

The system automatically routes reviews:

| Sentiment | Confidence | Stars | Action |
|-----------|-----------|-------|--------|
| Positive | >= 70% | Any | Redirect to Yandex Maps |
| Positive | < 70% | >= 4 | Redirect to Yandex Maps |
| Positive | < 70% | < 4 | Hidden section |
| Negative | Any | Any | Hidden section + promo code |

## Client Opt-Out

When a client clicks the "Unsubscribe" link in SMS:
- Client is marked as opted out
- All scheduled reminders are cancelled
- No new SMS will be sent to this client

## Security

- All client phone numbers are encrypted (AES-256-GCM)
- Data is stored on a Russian server (152-FZ compliance)
- Passwords are hashed (bcrypt)
- Sessions automatically expire after 7 days
