# Specification: Custom SMS Templates

## API Endpoints

### PUT /api/sms-templates
Upsert a template for a specific reminder number.

**Auth:** Required (JWT)

**Request:**
```json
{
  "reminder_number": 0,
  "message_template": "{company} просит оставить отзыв: {link}\nОтписка: {optout}"
}
```

**Validation:**
- reminder_number: 0-4 (integer)
- message_template: 10-500 chars, must contain {link} and {optout}
- {optout} is mandatory (152-ФЗ)

**Response 200:**
```json
{
  "id": "uuid",
  "reminder_number": 0,
  "message_template": "...",
  "created_at": "2026-03-11T..."
}
```

### GET /api/sms-templates
List all templates for the current admin.

**Auth:** Required (JWT)

**Response 200:**
```json
{
  "data": [
    { "id": "uuid", "reminder_number": 0, "message_template": "...", "created_at": "..." },
    { "id": "uuid", "reminder_number": 1, "message_template": "...", "created_at": "..." }
  ],
  "defaults": {
    "0": "{company} просит оставить отзыв: {link}\nОтписка: {optout}",
    "1": "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
    "2": "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
    "3": "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
    "4": "{company}: Последнее напоминание — оставьте отзыв: {link}\nОтписка: {optout}"
  }
}
```

### DELETE /api/sms-templates/:id
Delete a custom template (reverts to default).

**Auth:** Required (JWT)
**Response 204:** No content

## Acceptance Criteria

### AC-1: Upsert Template
- Admin can create/update a template for any reminder number (0-4)
- If template for that reminder_number exists → update, else → create

### AC-2: Mandatory Opt-Out
- Template without {optout} placeholder is rejected (400)

### AC-3: Mandatory Link
- Template without {link} placeholder is rejected (400)

### AC-4: Template Used in SMS
- Initial SMS uses template #0 (if exists)
- Reminders use templates #1-4 (if exist)
- Missing template → default message

### AC-5: Delete Reverts to Default
- Deleting a custom template makes the system use the default
