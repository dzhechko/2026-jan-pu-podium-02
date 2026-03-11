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

## Messenger Setup

**Page:** Settings (`/settings`)

ReviewHub supports SMS, Telegram, and Max channels.

### Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather) in Telegram
2. Copy the bot token
3. Paste the token in "Telegram Bot Token" on the Settings page
4. The system will auto-validate the token and register a webhook
5. Bot username will appear after successful setup

### Max (max.ru)

1. Create a bot in [Max](https://max.ru) settings
2. Copy the bot token
3. Paste the token in "Max Bot Token" on the Settings page
4. The system will auto-validate and register a webhook

### Automatic Client Linking

Clients are automatically linked to messengers via deep links:
- SMS messages include a link to your bot
- When a client taps the link, they're auto-linked to the messenger
- Future notifications arrive via messenger (free!)

## Sending Review Requests

### Single Send

1. On the "Clients" page, find the desired client
2. Select the send channel (SMS / Telegram / Max)
3. Click the send button
4. Client receives a message with a link to the review form

### Batch Send

1. On the "Clients" page, check the desired clients with checkboxes
2. Use "Select All" to select all active clients
3. Choose the send channel
4. Click "Send" in the action bar
5. System reports: sent / failed

### What the Client Receives

SMS message:
```
{Company Name} asks for a review: https://review.reviewhub.ru/review/{token}
Unsubscribe: https://review.reviewhub.ru/optout/{token}
Telegram: t.me/{bot}?start={id}
Max: max.ru/{bot}?start={id}
```

Messenger clients receive a formatted message with links.

### SMS Fallback

If messenger delivery fails (bot blocked, API error), the system automatically falls back to SMS.

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
| Messages sent | SMS + messengers in the period |
| Reviews | Number of reviews received |
| Conversion | Reviews / messages (%) |
| Avg rating | Average score (1-5) |
| Positive | Number of positive reviews |
| Negative | Number of negative reviews |

### Channel Analytics

The "By Channel" table shows per-channel stats (SMS, Telegram, Max):
- **Sent** — successful deliveries
- **Failed** — failed attempts
- **Reviews** — reviews received via this channel
- **Conversion** — review-to-sent ratio
- **SMS Fallback** — times a messenger failed and SMS was used instead

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
