# PRD: Multi-Channel Messaging (SMS + Telegram + Max)

## Problem Statement

ReviewHub currently supports only SMS (SMSC.ru) for sending review requests and cascade reminders. Many Russian SMB clients and their customers actively use Telegram and Max (ex-VK Teams) messengers. SMS delivery can be expensive and sometimes unreliable. Adding Telegram and Max channels will:
- Reduce messaging costs (messenger messages are free vs paid SMS)
- Increase delivery rates (messengers have higher open rates than SMS)
- Provide channel preference per customer
- Enable fallback strategy (if one channel fails, try another)

## Target Users

1. **Admin (business owner)** — configures channels, sets credentials, chooses delivery strategy
2. **Customer** — receives review request via preferred channel, clicks link to leave review

## User Stories

### US-MC-001: Admin configures Telegram bot
**As** an admin, **I want** to connect my Telegram bot to ReviewHub **so that** I can send review requests via Telegram.

**Acceptance Criteria:**
- Admin can enter Telegram Bot Token in Settings
- System validates token by calling Telegram getMe API
- System displays bot username after successful validation
- Token is stored encrypted (AES-256-GCM)

### US-MC-002: Admin configures Max bot
**As** an admin, **I want** to connect my Max bot to ReviewHub **so that** I can send review requests via Max messenger.

**Acceptance Criteria:**
- Admin can enter Max Bot Token in Settings
- System validates token by calling Max API
- System displays bot name after successful validation
- Token is stored encrypted (AES-256-GCM)

### US-MC-003: Admin assigns channel to client
**As** an admin, **I want** to specify preferred messaging channel per client **so that** each client receives messages via their preferred channel.

**Acceptance Criteria:**
- Client record has optional `telegramChatId` and `maxChatId` fields
- Admin can set channel preference: SMS (default), Telegram, Max
- If preferred channel is Telegram/Max but chatId is missing, fallback to SMS
- CSV import supports optional `telegram_chat_id` and `max_chat_id` columns

### US-MC-004: Send review request via Telegram
**As** an admin, **I want** to send review requests via Telegram **so that** customers who prefer Telegram get the link there.

**Acceptance Criteria:**
- System sends formatted message with review link and opt-out link via Telegram Bot API
- Message uses Markdown formatting for readability
- SmsLog (renamed MessageLog) records channel used
- If Telegram send fails, system falls back to SMS

### US-MC-005: Send review request via Max
**As** an admin, **I want** to send review requests via Max **so that** customers who prefer Max get the link there.

**Acceptance Criteria:**
- System sends formatted message with review link and opt-out link via Max Bot API
- Message uses Markdown formatting
- MessageLog records channel used
- If Max send fails, system falls back to SMS

### US-MC-006: Cascade reminders respect channel preference
**As** the system, **I want** cascade reminders to use the same channel as the initial message **so that** customers get consistent experience.

**Acceptance Criteria:**
- ReminderService reads `channel` from ReviewRequest
- Sends reminder via the recorded channel
- If channel fails, falls back to SMS
- MessageLog records actual channel used for each reminder

### US-MC-007: Admin selects channel when sending
**As** an admin, **I want** to choose which channel to use when sending review requests **so that** I have control over delivery method.

**Acceptance Criteria:**
- Clients page shows channel selector (SMS / Telegram / Max)
- Bulk send uses selected channel for all selected clients
- Individual send uses client's preferred channel by default
- Channel selector only shows channels with configured credentials

### US-MC-008: Message templates per channel
**As** an admin, **I want** to customize message templates per channel **so that** messages are optimized for each platform.

**Acceptance Criteria:**
- Template editor shows tab per channel (SMS, Telegram, Max)
- Each channel has its own set of templates (reminder 0-4)
- SMS templates: plain text, 160-char awareness
- Telegram/Max templates: Markdown support, longer messages allowed
- Required placeholders: `{link}`, `{optout}` (same across all channels)

## Out of Scope (v1)
- WhatsApp Business API integration
- Viber integration
- Auto-detection of customer's preferred channel
- Two-way messaging (receiving replies via Telegram/Max)
- Channel analytics comparison dashboard

## Success Metrics
- 30%+ of review requests sent via messengers within 30 days of launch
- 15%+ higher conversion rate for messenger-sent vs SMS-sent requests
- Zero increase in error rate during delivery
