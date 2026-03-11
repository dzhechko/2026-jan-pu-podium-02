# Pseudocode: Multi-Channel Messaging

## 1. MessageProvider Interface & Implementations

### TelegramProvider

```
CLASS TelegramProvider IMPLEMENTS MessageProvider:
  channel = "telegram"

  CONSTRUCTOR(token: string):
    this.token = token
    this.baseUrl = "https://api.telegram.org/bot" + token

  ASYNC send(chatId: string, message: string) -> MessageResult:
    TRY:
      response = HTTP_POST(this.baseUrl + "/sendMessage", {
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: false
      }, timeout: 10000)

      data = response.json()
      IF data.ok:
        RETURN { success: true, externalId: String(data.result.message_id) }
      ELSE:
        RETURN { success: false, error: data.description }
    CATCH err:
      RETURN { success: false, error: String(err) }

  ASYNC validateCredentials() -> boolean:
    TRY:
      response = HTTP_GET(this.baseUrl + "/getMe", timeout: 5000)
      data = response.json()
      RETURN data.ok === true
    CATCH:
      RETURN false
```

### MaxProvider

```
CLASS MaxProvider IMPLEMENTS MessageProvider:
  channel = "max"

  CONSTRUCTOR(token: string):
    this.token = token
    this.baseUrl = "https://botapi.max.ru"

  ASYNC send(chatId: string, message: string) -> MessageResult:
    TRY:
      response = HTTP_POST(this.baseUrl + "/messages?access_token=" + this.token, {
        chat_id: chatId,
        text: message
      }, timeout: 10000)

      data = response.json()
      IF data.message:
        RETURN { success: true, externalId: String(data.message.body.mid) }
      ELSE:
        RETURN { success: false, error: data.error || data.description || "Unknown error" }
    CATCH err:
      RETURN { success: false, error: String(err) }

  ASYNC validateCredentials() -> boolean:
    TRY:
      response = HTTP_GET(this.baseUrl + "/me?access_token=" + this.token, timeout: 5000)
      data = response.json()
      RETURN data.user_id IS NOT NULL
    CATCH:
      RETURN false
```

## 2. MessageGateway (with fallback template re-fetch)

```
INTERFACE Recipient:
  phone: string               // Always available (required field)
  telegramChatId?: string
  maxChatId?: string

CLASS MessageGateway:
  providers: Map<string, MessageProvider> = {}

  CONSTRUCTOR(smscService, telegramToken?, maxToken?):
    this.providers.set("sms", smscService)
    IF telegramToken:
      this.providers.set("telegram", new TelegramProvider(telegramToken))
    IF maxToken:
      this.providers.set("max", new MaxProvider(maxToken))

  ASYNC send(
    channel: string,
    recipient: Recipient,
    messageFetcher: (ch: string) -> ASYNC string  // Re-fetches template per channel
  ) -> MessageResult & { actualChannel: string }:

    recipientId = this.getRecipientId(channel, recipient)
    provider = this.providers.get(channel)

    // Try primary channel
    IF provider AND recipientId:
      message = AWAIT messageFetcher(channel)
      result = AWAIT provider.send(recipientId, message)
      IF result.success:
        RETURN { ...result, actualChannel: channel }
      ELSE:
        LOG_WARN("Channel " + channel + " failed: " + result.error)

    // Fallback to SMS (with SMS-specific template!)
    IF channel != "sms":
      smsProvider = this.providers.get("sms")
      IF smsProvider AND recipient.phone:
        smsMessage = AWAIT messageFetcher("sms")  // RE-FETCH SMS template (AC-9)
        smsResult = AWAIT smsProvider.send(recipient.phone, smsMessage)
        RETURN { ...smsResult, actualChannel: "sms", fallbackFrom: channel }

    RETURN { success: false, error: "No channel available", actualChannel: channel }

  getRecipientId(channel: string, recipient: Recipient) -> string?:
    SWITCH channel:
      CASE "sms": RETURN recipient.phone
      CASE "telegram": RETURN recipient.telegramChatId
      CASE "max": RETURN recipient.maxChatId
      DEFAULT: RETURN null

  getConfiguredChannels() -> string[]:
    RETURN Array.from(this.providers.keys())

  hasChannel(channel: string) -> boolean:
    RETURN this.providers.has(channel)
```

## 3. Modified ReviewRequestService.sendReviewRequests

```
ASYNC sendReviewRequests(adminId, clientIds, requestedChannel?):
  admin = AWAIT prisma.admin.findUniqueOrThrow({ where: { id: adminId } })
  sent = 0, failed = 0

  FOR EACH clientId IN clientIds:
    client = AWAIT prisma.client.findFirst({ where: { id: clientId, adminId } })
    IF NOT client OR client.optedOut:
      failed++; CONTINUE

    // Determine channel
    channel = requestedChannel OR client.preferredChannel OR "sms"

    // Determine recipient based on channel
    recipient = SWITCH channel:
      CASE "telegram": client.telegramChatId
      CASE "max": client.maxChatId
      CASE "sms": encryption.decrypt(client.phoneEncrypted)

    // If no recipient for channel, fallback to SMS
    smsPhone = encryption.decrypt(client.phoneEncrypted)
    IF NOT recipient:
      channel = "sms"
      recipient = smsPhone

    // Create review request
    token = randomUUID().replace(/-/g, '')
    reviewRequest = AWAIT prisma.reviewRequest.create({
      data: { adminId, clientId, token, status: "PENDING", channel,
              expiresAt: now + 30_DAYS }
    })

    // Build recipient object
    recipientObj = {
      phone: smsPhone,
      telegramChatId: client.telegramChatId,
      maxChatId: client.maxChatId
    }

    // Build message fetcher (re-fetches per channel for fallback)
    link = pwaUrl + "/review/" + token
    optout = pwaUrl + "/optout/" + token
    messageFetcher = (ch) => templateService.getMessage(adminId, 0, admin.companyName, link, optout, ch)

    // Send via gateway (handles fallback + template re-fetch)
    result = AWAIT gateway.send(channel, recipientObj, messageFetcher)

    IF result.success:
      AWAIT prisma.reviewRequest.update(reviewRequest.id, {
        status: "SMS_SENT", smsSentAt: now,
        nextReminderAt: now + 2_HOURS,
        channel: result.fallbackFrom ? "sms" : channel
      })
      AWAIT createMessageLog(reviewRequest.id, recipient, message, result, channel)
      sent++
    ELSE:
      AWAIT createMessageLog(reviewRequest.id, recipient, message, result, channel)
      failed++

  RETURN { sent, failed }
```

## 4. Modified ReminderService.processReminders

```
ASYNC processReminders():
  requests = AWAIT prisma.reviewRequest.findMany({
    where: {
      nextReminderAt: { lte: NOW },
      status: { notIn: ["REVIEWED", "OPTED_OUT", "EXPIRED"] },
      reminderCount: { lt: 4 }
    },
    include: { client: true },
    take: 50
  })

  FOR EACH request IN requests:
    IF request.expiresAt < NOW:
      markExpired(request); CONTINUE
    IF request.client.optedOut:
      markOptedOut(request); CONTINUE

    channel = request.channel  // Use same channel as initial send

    // Get recipient
    recipient = SWITCH channel:
      CASE "telegram": request.client.telegramChatId
      CASE "max": request.client.maxChatId
      CASE "sms": encryption.decrypt(request.client.phoneEncrypted)

    smsPhone = encryption.decrypt(request.client.phoneEncrypted)
    IF NOT recipient:
      channel = "sms"
      recipient = smsPhone

    // Build recipient + message fetcher
    nextNum = request.reminderCount + 1
    link = pwaUrl + "/review/" + request.token
    optout = pwaUrl + "/optout/" + request.token
    recipientObj = { phone: smsPhone, telegramChatId: request.client.telegramChatId, maxChatId: request.client.maxChatId }
    messageFetcher = (ch) => templateService.getMessage(request.adminId, nextNum, admin.companyName, link, optout, ch)

    // Send via gateway (handles fallback + template re-fetch)
    result = AWAIT gateway.send(channel, recipientObj, messageFetcher)

    IF result.success:
      updateReminder(request, nextNum)
      createMessageLog(request.id, recipient, message, result, channel)
    ELSE:
      logError("Reminder failed", request.id, result.error)
```

## 5. Settings: Save & Validate Bot Tokens

```
ASYNC updateChannelSettings(adminId, telegramToken?, maxToken?):
  updates = {}

  IF telegramToken IS PROVIDED:
    IF telegramToken IS EMPTY:
      // Remove Telegram config
      updates.telegramBotTokenEncrypted = null
      updates.telegramBotUsername = null
    ELSE:
      // Validate
      provider = new TelegramProvider(telegramToken)
      valid = AWAIT provider.validateCredentials()
      IF NOT valid: THROW "Invalid Telegram bot token"

      // Get bot info
      info = AWAIT HTTP_GET("https://api.telegram.org/bot" + telegramToken + "/getMe")
      updates.telegramBotTokenEncrypted = encryption.encrypt(telegramToken)
      updates.telegramBotUsername = info.result.username

  IF maxToken IS PROVIDED:
    IF maxToken IS EMPTY:
      updates.maxBotTokenEncrypted = null
      updates.maxBotName = null
    ELSE:
      provider = new MaxProvider(maxToken)
      valid = AWAIT provider.validateCredentials()
      IF NOT valid: THROW "Invalid Max bot token"

      info = AWAIT HTTP_GET("https://botapi.max.ru/me?access_token=" + maxToken)
      updates.maxBotTokenEncrypted = encryption.encrypt(maxToken)
      updates.maxBotName = info.name

  AWAIT prisma.admin.update({ where: { id: adminId }, data: updates })
```

## 6. Template Service: Channel-Aware

```
ASYNC getMessage(adminId, reminderNumber, companyName, link, optout, channel = "sms"):
  // Try admin-custom template for this channel
  template = AWAIT prisma.smsTemplate.findUnique({
    where: { adminId_reminderNumber_channel: { adminId, reminderNumber, channel } }
  })

  IF NOT template:
    // Fallback to default for channel
    text = getDefaultTemplate(reminderNumber, channel)
  ELSE:
    text = template.messageTemplate

  // Replace placeholders
  RETURN text
    .replace("{company}", companyName)
    .replace("{link}", link)
    .replace("{optout}", optout)

FUNCTION getDefaultTemplate(reminderNumber, channel):
  IF channel == "sms":
    // Existing SMS defaults (compact, no emoji)
    RETURN existing logic...

  IF channel IN ["telegram", "max"]:
    // Messenger defaults (richer, with emoji)
    SWITCH reminderNumber:
      CASE 0: RETURN "👋 *{company}* приглашает оставить отзыв!\n\n🔗 {link}\n\n_Отписка: {optout}_"
      CASE 1-3: RETURN "🔔 *{company}*: напоминаем — оставьте отзыв!\n\n🔗 {link}\n\n_Отписка: {optout}_"
      CASE 4: RETURN "⏰ *{company}*: последнее напоминание!\n\n🔗 {link}\n\n_Отписка: {optout}_"
```

## 7. CSV Import: Extended Columns

```
ASYNC importClientsFromCsv(adminId, csvRows):
  FOR EACH row IN csvRows:
    telegramChatId = row.telegram_chat_id?.trim() OR null
    maxChatId = row.max_chat_id?.trim() OR null

    // Auto-detect preferred channel from available IDs
    preferredChannel = row.preferred_channel?.trim()
    IF NOT preferredChannel OR preferredChannel NOT IN ["sms", "telegram", "max"]:
      IF telegramChatId:
        preferredChannel = "telegram"
      ELSE IF maxChatId:
        preferredChannel = "max"
      ELSE:
        preferredChannel = "sms"

    // Validate telegram_chat_id format (numeric)
    IF telegramChatId AND NOT /^\d+$/.test(telegramChatId):
      MARK_ROW_ERROR(row, "telegram_chat_id must be numeric")
      CONTINUE

    AWAIT prisma.client.create({
      data: {
        adminId,
        name: row.name,
        phoneEncrypted: encryption.encrypt(row.phone),
        telegramChatId,
        maxChatId,
        preferredChannel
      }
    })
```

## 8. GET /api/settings/channels

```
ASYNC getChannels(adminId):
  admin = AWAIT prisma.admin.findUniqueOrThrow({ where: { id: adminId } })

  channels = [
    { type: "sms", configured: true }  // SMS always available (env-based)
  ]

  IF admin.telegramBotTokenEncrypted:
    channels.push({
      type: "telegram",
      configured: true,
      bot_username: admin.telegramBotUsername
    })
  ELSE:
    channels.push({ type: "telegram", configured: false })

  IF admin.maxBotTokenEncrypted:
    channels.push({
      type: "max",
      configured: true,
      bot_name: admin.maxBotName
    })
  ELSE:
    channels.push({ type: "max", configured: false })

  RETURN { channels }
```

## 9. Telegram Bot /start Handler (AC-8)

```
// Telegram bot can only message users who have /start-ed it.
// This section describes the flow for capturing chat_id.

// Option A: Admin shares bot link (t.me/BotUsername) with clients
// Client opens link → clicks "Start" → bot receives update with chat_id

// The bot webhook/polling handler:
ASYNC handleTelegramUpdate(update):
  IF update.message AND update.message.text == "/start":
    chatId = String(update.message.chat.id)
    userName = update.message.from.first_name OR "Клиент"

    // Send welcome message
    AWAIT telegramProvider.send(chatId,
      "Здравствуйте! Этот бот используется для отправки запросов на отзыв. " +
      "Ваш chat ID: " + chatId
    )

    // NOTE: Auto-linking chat_id to client is out of scope for v1.
    // Admin manually enters chat_id in client record or CSV import.
    // Future: match by phone number or deep-link parameter.

// On send failure (403 Forbidden = user hasn't /start-ed):
// MessageGateway handles this via normal fallback to SMS (AC-8)

## 10. MessageLog Helper

```
ASYNC createMessageLog(reviewRequestId, recipientMasked, messagePreview, result, channel):
  phoneMasked = IF channel == "sms":
    recipientMasked.slice(0, 4) + "****" + recipientMasked.slice(-2)
  ELSE:
    channel + ":" + recipientMasked  // e.g., "telegram:123456789"

  AWAIT prisma.smsLog.create({
    data: {
      reviewRequestId,
      phoneMasked,
      messagePreview: messagePreview.slice(0, 100),
      smscMessageId: IF channel == "sms" THEN result.externalId ELSE null,
      externalId: result.externalId,
      channel,
      status: result.success ? "SENT" : "FAILED",
      sentAt: result.success ? NOW : null
    }
  })

  // Log fallback attempt separately
  IF result.fallbackFrom:
    AWAIT prisma.smsLog.create({
      data: {
        reviewRequestId,
        phoneMasked: result.fallbackFrom + ":failed",
        messagePreview: "Fallback from " + result.fallbackFrom + " to sms",
        channel: result.fallbackFrom,
        status: "FAILED",
        sentAt: null
      }
    })
```
