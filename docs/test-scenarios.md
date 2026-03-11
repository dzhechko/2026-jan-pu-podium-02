# BDD Test Scenarios: ReviewHub

## Feature: Admin Authentication

```gherkin
Feature: Admin Authentication

  Scenario: Successful registration
    Given I am on the registration page
    When I enter email "admin@clinic.ru", password "Secure123!", company "Клиника Здоровье", phone "+79001234567"
    Then my account is created
    And I receive a JWT token
    And I am redirected to dashboard

  Scenario: Login with valid credentials
    Given I am registered with email "admin@clinic.ru"
    When I login with correct password
    Then I receive access and refresh tokens
    And I see the dashboard

  Scenario: Login with invalid password
    Given I am registered with email "admin@clinic.ru"
    When I login with wrong password
    Then I see error "Неверный email или пароль"
    And no token is issued

  Scenario: Login rate limiting
    Given I failed login 5 times in 15 minutes
    When I try to login again
    Then I receive 429 "Too many attempts"
    And I must wait 15 minutes

  Scenario: Token refresh
    Given my access token has expired
    When I send valid refresh token
    Then I receive new access and refresh tokens
```

## Feature: Client Management

```gherkin
Feature: Client Management

  Scenario: Add single client
    Given I am logged in as admin
    When I add client "Иван Петров" with phone "+79001234567"
    Then client appears in my client list
    And phone is stored encrypted

  Scenario: Add client with duplicate phone
    Given client with phone "+79001234567" exists
    When I try to add another client with same phone
    Then I see error "Клиент с таким телефоном уже существует"

  Scenario: Import clients from CSV
    Given I have a CSV file with 50 clients (name, phone columns)
    When I upload the CSV
    Then 50 clients are imported
    And I see import summary "Импортировано: 50, Пропущено: 0"

  Scenario: Import CSV with duplicates
    Given 10 of 50 clients already exist
    When I upload the CSV
    Then 40 new clients are imported
    And I see "Импортировано: 40, Пропущено: 10"

  Scenario: Delete client
    Given client "Иван" has no pending review requests
    When I delete client "Иван"
    Then client is removed from list
    And all associated data is deleted
```

## Feature: SMS Review Request

```gherkin
Feature: Send Review Request

  Scenario: Send to single client
    Given I have client "Иван" with phone "+79001234567"
    And I have SMSC.ru configured
    When I click "Запросить отзыв" for Иван
    Then SMS is sent with PWA link
    And review request status is "SMS_SENT"
    And first reminder is scheduled for 2 hours later

  Scenario: Send to multiple clients
    Given I select 10 clients
    When I click "Запросить отзыв" for selected
    Then 10 SMS are sent
    And each client gets unique PWA link

  Scenario: Send to opted-out client
    Given client "Мария" has opted out
    When I try to send review request to Мария
    Then SMS is NOT sent
    And I see warning "Клиент отписался от рассылки"

  Scenario: SMSC.ru delivery failure
    Given SMSC.ru returns error for phone "+79001234567"
    When SMS fails to send
    Then status shows "Не доставлено"
    And system retries 3 times with backoff
    And admin sees failure notification
```

## Feature: Cascade Reminders

```gherkin
Feature: Cascade Reminders

  Scenario: Full 4-step cascade
    Given review request sent at 14:00 on March 11
    And client has not left a review
    Then reminder 1 is sent at 16:00 March 11
    And reminder 2 at 14:00 March 12
    And reminder 3 at 14:00 March 14
    And reminder 4 at 14:00 March 18
    And no further reminders

  Scenario: Stop on review submission
    Given client received reminder 1
    When client submits review at 17:00
    Then reminders 2, 3, 4 are cancelled
    And no more SMS sent to this client for this request

  Scenario: Stop on opt-out
    Given client received reminder 2
    When client clicks opt-out link
    Then reminders 3, 4 are cancelled
    And client marked as opted_out globally
    And no future SMS for any request

  Scenario: Different message for each reminder
    Given cascade is active
    Then reminder 1 text differs from initial SMS
    And reminder 2 text mentions increased discount
    And reminder 3 text uses scarcity ("48 часов")
    And reminder 4 text uses finality ("Последнее напоминание")
```

## Feature: PWA Review Form

```gherkin
Feature: PWA Review Form

  Scenario: Open form with valid token
    Given valid review token "abc123"
    When I open review.reviewhub.ru/abc123
    Then I see company name "Клиника Здоровье"
    And I see discount offer "Скидка 10% за отзыв"
    And I see star rating selector (1-5)
    And I see text input field

  Scenario: Open form with expired token
    Given token "old123" expired 5 days ago
    When I open review.reviewhub.ru/old123
    Then I see message "Ссылка устарела"

  Scenario: Open already reviewed token
    Given token "done123" already has a review
    When I open review.reviewhub.ru/done123
    Then I see message "Вы уже оставили отзыв. Спасибо!"

  Scenario: Submit review - stars only
    Given I opened the review form
    When I select 5 stars and leave text empty
    And I click Submit
    Then review is saved with stars=5, text=""
    And sentiment determined by stars only

  Scenario: Submit review - full
    Given I opened the review form
    When I select 4 stars and write "Отличная клиника, рекомендую!"
    And I click Submit
    Then review is saved
    And LLM analyzes sentiment
```

## Feature: Sentiment Analysis & Routing

```gherkin
Feature: Sentiment Routing

  Scenario: Positive review → Yandex Maps redirect
    Given review text "Замечательный сервис, спасибо!" with 5 stars
    When LLM returns sentiment="positive", confidence=0.95
    Then review routed_to = "YANDEX_REDIRECT"
    And customer sees "Оставьте отзыв на Яндекс Картах"
    And redirect button links to yandex.ru/maps/org/{org_id}/reviews/
    And customer receives promo code

  Scenario: Negative review → hidden section
    Given review text "Ужасное обслуживание" with 1 star
    When LLM returns sentiment="negative", confidence=0.90
    Then review routed_to = "INTERNAL_HIDDEN"
    And customer sees "Спасибо за обратную связь"
    And customer receives promo code
    And admin sees review in negative reviews dashboard

  Scenario: Low confidence → star-based fallback
    Given review text "Ну такое, средненько" with 3 stars
    When LLM returns confidence=0.55 (< 0.7 threshold)
    Then system uses star rating (3 < 4 → negative)
    And review routed_to = "INTERNAL_HIDDEN"

  Scenario: LLM API unavailable
    Given LLM API returns 500 error
    When review submitted with 5 stars
    Then system uses stars (5 >= 4 → positive)
    And review routed_to = "YANDEX_REDIRECT"
    And error logged to monitoring
```

## Feature: Analytics Dashboard

```gherkin
Feature: Analytics Dashboard

  Scenario: View 30-day summary
    Given I am logged in as admin
    And I have 50 reviews in the last 30 days
    When I open Analytics page with period="30d"
    Then I see total SMS sent
    And total reviews received
    And conversion rate (reviews/SMS)
    And positive vs negative breakdown
    And average star rating
    And reviews-by-day chart

  Scenario: No data yet
    Given I just registered
    When I open Analytics page
    Then I see "Нет данных. Отправьте первый запрос на отзыв!"
```

## Feature: Security

```gherkin
Feature: Security

  Scenario: SMS includes opt-out
    Given SMS is sent to client
    Then SMS text includes opt-out link
    And link format is {PWA_URL}/opt-out/{token}

  Scenario: Phone numbers encrypted at rest
    Given client with phone "+79001234567" is stored
    When I query database directly
    Then phone field contains encrypted bytes (not plaintext)

  Scenario: CORS blocks unauthorized origins
    Given API is running
    When request comes from unauthorized origin "evil.com"
    Then request is blocked with CORS error

  Scenario: Rate limiting on public endpoints
    Given PWA form endpoint /api/reviews/submit/:token
    When more than 10 requests per minute from same IP
    Then subsequent requests return 429
```
