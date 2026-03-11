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
        RETURN { success: false, error: data.message || "Unknown error" }
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

## 2. MessageGateway

```
CLASS MessageGateway:
  providers: Map<string, MessageProvider> = {}

  CONSTRUCTOR(smscService, telegramToken?, maxToken?):
    this.providers.set("sms", smscService)
    IF telegramToken:
      this.providers.set("telegram", new TelegramProvider(telegramToken))
    IF maxToken:
      this.providers.set("max", new MaxProvider(maxToken))

  ASYNC send(channel: string, recipient: string, message: string, smsPhone?: string) -> MessageResult:
    provider = this.providers.get(channel)

    IF NOT provider:
      IF channel != "sms" AND smsPhone:
        // Channel not configured, fallback to SMS
        RETURN this.send("sms", smsPhone, message)
      RETURN { success: false, error: "Channel not configured: " + channel }

    result = AWAIT provider.send(recipient, message)

    // Fallback: if messenger fails and SMS is available
    IF NOT result.success AND channel != "sms" AND smsPhone:
      smsResult = AWAIT this.providers.get("sms").send(smsPhone, message)
      smsResult.fallbackFrom = channel  // Track that fallback was used
      RETURN smsResult

    RETURN result

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

    // Build message
    link = pwaUrl + "/review/" + token
    optout = pwaUrl + "/optout/" + token
    message = AWAIT templateService.getMessage(adminId, 0, admin.companyName, link, optout, channel)

    // Send via gateway
    result = AWAIT gateway.send(channel, recipient, message, smsPhone)

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

    // Build message
    nextNum = request.reminderCount + 1
    link = pwaUrl + "/review/" + request.token
    optout = pwaUrl + "/optout/" + request.token
    message = AWAIT templateService.getMessage(request.adminId, nextNum, admin.companyName, link, optout, channel)

    // Send
    result = AWAIT gateway.send(channel, recipient, message, smsPhone)

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
