# Specification: ReviewHub

## Feature Matrix

| Feature | MVP | v1.0 | v2.0 |
|---------|:---:|:----:|:----:|
| Admin auth (email/password) | ✅ | ✅ | ✅ |
| Client database (manual) | ✅ | ✅ | ✅ |
| Client database (CSV import) | | ✅ | ✅ |
| Company profile + Yandex link | ✅ | ✅ | ✅ |
| Manual SMS sending | ✅ | ✅ | ✅ |
| Cascade reminders (4-step) | | ✅ | ✅ |
| Auto-send after service | | ✅ | ✅ |
| PWA review form | ✅ | ✅ | ✅ |
| LLM sentiment analysis | ✅ | ✅ | ✅ |
| Redirect positive → Yandex | ✅ | ✅ | ✅ |
| Negative → hidden section | ✅ | ✅ | ✅ |
| Basic analytics | ✅ | ✅ | ✅ |
| SMS delivery tracking | | ✅ | ✅ |
| Custom SMS templates | | ✅ | ✅ |
| Promo code generation | | ✅ | ✅ |
| Multi-platform (Google, 2GIS) | | | ✅ |
| WhatsApp/Telegram | | | ✅ |

---

## User Stories with Acceptance Criteria

### US-001: Admin Registration

```gherkin
Feature: Admin Registration

  Scenario: Successful registration
    Given I am on the registration page
    When I enter valid email, password, company name, and phone
    Then my account is created
    And I am redirected to the dashboard

  Scenario: Duplicate email
    Given user with email "test@test.com" already exists
    When I try to register with "test@test.com"
    Then I see error "Email already registered"

  Scenario: Weak password
    Given I am on the registration page
    When I enter a password shorter than 8 characters
    Then I see error "Password must be at least 8 characters"
```

### US-003: Company Profile Setup

```gherkin
Feature: Company Profile

  Scenario: Set Yandex Maps link
    Given I am logged in as admin
    When I enter my Yandex Maps organization URL
    Then the system extracts org_id
    And saves it for review redirect

  Scenario: Invalid Yandex Maps URL
    Given I am on company settings
    When I enter an invalid URL
    Then I see error "Invalid Yandex Maps URL"
```

### US-004: Manual SMS Sending

```gherkin
Feature: Manual SMS Send

  Scenario: Send to single client
    Given I have client "Ivan" with phone "+79001234567"
    When I click "Send Review Request" for Ivan
    Then SMS is sent via SMSC.ru API
    And status shows "Sent"
    And a review_request record is created

  Scenario: Send to multiple clients
    Given I select 5 clients
    When I click "Send Bulk Review Request"
    Then 5 SMS are queued and sent
    And each gets unique PWA link with token

  Scenario: SMSC.ru error
    Given SMSC.ru returns error
    Then status shows "Failed"
    And admin sees "SMS delivery failed, retry?"
```

### US-011: Cascade Reminders

```gherkin
Feature: Cascade Reminders

  Scenario: Full cascade without review
    Given client received review request at 14:00
    And client has not left a review
    Then reminder 1 is sent at 16:00 (2h)
    And reminder 2 is sent next day at 14:00 (24h)
    And reminder 3 is sent in 3 days
    And reminder 4 is sent in 7 days
    And no more reminders after that

  Scenario: Client leaves review after reminder 2
    Given client received reminder 2
    When client submits a review via PWA
    Then reminders 3 and 4 are cancelled
    And no more SMS are sent

  Scenario: Client opts out
    Given client clicks opt-out link in SMS
    Then all pending reminders are cancelled
    And client is marked as opted-out
    And no future SMS will be sent
```

### US-015: PWA Review Form

```gherkin
Feature: PWA Review Form

  Scenario: Submit positive review
    Given I opened PWA via SMS link
    And I see company name and discount offer
    When I rate 5 stars and write "Great service!"
    And I click Submit
    Then review is saved
    And LLM analyzes sentiment as "positive"
    And I see "Would you leave this review on Yandex Maps?"
    And I see a button linking to Yandex Maps review page

  Scenario: Submit negative review
    Given I opened PWA via SMS link
    When I rate 2 stars and write "Terrible experience"
    And I click Submit
    Then review is saved
    And LLM analyzes sentiment as "negative"
    And I see "Thank you for your feedback"
    And I receive promo code
    And review is stored in hidden section

  Scenario: Expired link
    Given my review link token has expired (>30 days)
    When I try to open the PWA
    Then I see "This link has expired"
```

### US-019: Sentiment Analysis

```gherkin
Feature: Sentiment Analysis

  Scenario: Positive sentiment detected
    Given a review with text "Отличный сервис, спасибо!" and 5 stars
    When LLM analyzes the text
    Then sentiment = "positive" with confidence >= 0.7
    And review is routed to Yandex Maps redirect flow

  Scenario: Negative sentiment detected
    Given a review with text "Ужасное обслуживание, больше не приду" and 1 star
    When LLM analyzes the text
    Then sentiment = "negative"
    And review is stored in hidden section

  Scenario: Mixed sentiment - use star rating as tiebreaker
    Given a review with mixed text but 4 stars
    When LLM returns confidence < 0.7
    Then system uses star rating (>=4 = positive)

  Scenario: LLM API unavailable
    Given LLM API returns error
    Then system falls back to star rating only
    And logs the error for monitoring
```

---

## Non-Functional Requirements

### NFR-001: Performance
- PWA first load: <2s on 3G
- API response p99: <500ms
- SMS queue processing: 100 SMS/min
- LLM response: <3s per review

### NFR-002: Security
- JWT auth with refresh tokens (access: 15min, refresh: 7d)
- Bcrypt password hashing (cost factor 12)
- Rate limiting: 100 req/min per IP
- CSRF protection on all forms
- Input sanitization (XSS prevention)
- SQL injection prevention via parameterized queries

### NFR-003: Data Protection (152-ФЗ)
- All data stored on Russian VPS
- Phone numbers encrypted at rest
- Consent for SMS required and recorded
- Opt-out mechanism in every SMS
- Data retention policy: 2 years

### NFR-004: Availability
- Uptime SLA: 99.5%
- Planned maintenance: weekdays 03:00-05:00 MSK
- SMS delivery monitoring with alerts

### NFR-005: Localization
- UI language: Russian
- Timezone: Moscow (MSK) default, configurable
- Phone format: +7XXXXXXXXXX
- Currency: ₽ (RUB)
