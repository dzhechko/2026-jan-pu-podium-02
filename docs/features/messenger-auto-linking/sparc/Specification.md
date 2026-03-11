# Specification: Messenger Auto-Linking

## User Stories

### US-1: Webhook Registration
**As an** admin,
**I want** the system to automatically register webhooks when I save a bot token,
**So that** the bot can receive messages from clients without manual setup.

**Acceptance Criteria:**
```gherkin
Scenario: Telegram webhook auto-registration
  Given admin saves a valid Telegram bot token
  When the token is validated successfully
  Then the system registers a webhook URL with Telegram Bot API
  And the webhook URL is "{API_BASE_URL}/api/webhooks/telegram/{adminId}"
  And webhook registration result is logged

Scenario: Webhook registration failure
  Given admin saves a valid Telegram bot token
  When webhook registration fails (network error, invalid token)
  Then the bot token is still saved
  And admin sees a warning "Бот сохранён, но webhook не зарегистрирован. Автопривязка может не работать."
  And system retries webhook registration on next settings save
```

### US-2: Deep Link in SMS
**As a** client,
**I want** to receive a direct link to the bot in my first SMS,
**So that** I can connect to the bot with one tap.

**Acceptance Criteria:**
```gherkin
Scenario: SMS includes bot deep link when Telegram configured
  Given admin has a configured Telegram bot with username "review_bot"
  And client "Ivan" does not have a telegram_chat_id
  When admin sends a review request to Ivan via SMS
  Then the SMS message includes a link "t.me/review_bot?start={client_uuid}"
  And the SMS text explains "Подключите Telegram для удобства: {link}"

Scenario: SMS without bot link when no bot configured
  Given admin has NOT configured a Telegram bot
  When admin sends a review request via SMS
  Then the SMS message does NOT include any bot link

Scenario: SMS without bot link when client already linked
  Given client "Ivan" already has a telegram_chat_id
  When admin sends a review request to Ivan
  Then the SMS message does NOT include a bot link
  And the request is sent via Telegram directly
```

### US-3: Auto-Linking via Webhook
**As a** system,
**I want** to automatically link a client's chat_id when they start the bot,
**So that** future messages can be sent via messenger.

**Acceptance Criteria:**
```gherkin
Scenario: Successful auto-linking via Telegram /start
  Given client "Ivan" with id "abc-123" exists
  And admin has a configured Telegram bot
  When Ivan opens "t.me/review_bot?start=abc-123"
  And Ivan taps "Start" in Telegram
  Then webhook receives update with chat_id=12345 and start parameter="abc-123"
  And system encrypts chat_id and saves to client "abc-123"
  And client preferred_channel is updated to "telegram"
  And bot sends a confirmation message to Ivan: "Вы подключены! Теперь уведомления будут приходить сюда."

Scenario: Auto-linking with invalid client ID
  Given no client exists with id "nonexistent-id"
  When webhook receives /start with parameter "nonexistent-id"
  Then system ignores the update
  And no error is thrown (silent fail for security)

Scenario: Auto-linking when client already linked
  Given client "Ivan" already has telegram_chat_id
  When Ivan sends /start again with same deep link
  Then system updates chat_id (may have changed)
  And sends confirmation message

Scenario: Auto-linking via Max
  Given admin has a configured Max bot
  And client "Maria" exists with id "def-456"
  When Maria starts a chat with the Max bot with deep link parameter "def-456"
  Then system saves Max chat_id encrypted
  And updates preferred_channel to "max"
```

### US-4: Admin UI — Linking Status
**As an** admin,
**I want** to see which clients are linked to messengers,
**So that** I know who can receive messages via messenger vs SMS.

**Acceptance Criteria:**
```gherkin
Scenario: Client list shows linking status
  Given admin views the client list
  Then each client shows messenger badges (SMS, Telegram, Max)
  And unlinked messengers are not shown
  And linked messengers show a green badge

Scenario: Client form without manual chat_id input
  Given admin opens the "Add Client" form
  Then there are NO fields for manual Telegram/Max chat_id entry
  And a help text explains: "Клиент подключит мессенджер автоматически через ссылку"

Scenario: Bot link shown in client detail
  Given admin has a configured Telegram bot "@review_bot"
  And client "Ivan" is not linked to Telegram
  When admin views Ivan's client card
  Then admin sees a copyable link: "t.me/review_bot?start={ivan_uuid}"
  And text: "Отправьте эту ссылку клиенту для подключения Telegram"
```

## Non-Functional Requirements

### Security
- Webhook endpoints are public but MUST verify request authenticity
  - Telegram: validate `X-Telegram-Bot-Api-Secret-Token` header
  - Max: validate request signature
- Deep link parameter is client UUID (not phone), preventing enumeration
- Webhook endpoints are rate-limited: 100 req/min per adminId

### Performance
- Webhook processing: < 200ms response time (Telegram requires fast response)
- Auto-linking DB write: async after responding 200 to webhook
- No blocking operations in webhook handler

### Reliability
- Webhook endpoint must return 200 even on processing errors (Telegram retries on non-200)
- Idempotent linking: multiple /start with same params = same result
- Fallback: if webhook fails, admin can still send via SMS (existing behavior)

## Validation Rules

- `adminId` in webhook URL: must be valid UUID
- Telegram `chat_id`: positive integer
- Max `chat_id`: non-empty string
- Deep link parameter (`start`): valid UUID format matching existing client
- Webhook payload: validated against expected schema per platform
