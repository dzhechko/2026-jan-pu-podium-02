# Pseudocode: Custom SMS Templates

## Constants

```
DEFAULT_TEMPLATES = {
  0: "{company} просит оставить отзыв: {link}\nОтписка: {optout}",
  1: "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
  2: "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
  3: "{company}: Напоминаем — оставьте отзыв: {link}\nОтписка: {optout}",
  4: "{company}: Последнее напоминание — оставьте отзыв: {link}\nОтписка: {optout}",
}
REQUIRED_PLACEHOLDERS = ['{link}', '{optout}']
```

## Algorithm: upsertTemplate

```
FUNCTION upsertTemplate(adminId, reminderNumber, messageTemplate):
  VALIDATE reminderNumber IN [0, 1, 2, 3, 4]
  VALIDATE messageTemplate.length IN [10, 500]
  FOR placeholder IN REQUIRED_PLACEHOLDERS:
    IF placeholder NOT IN messageTemplate:
      THROW ValidationError("Шаблон должен содержать {placeholder}")

  existing = SELECT FROM sms_templates
    WHERE admin_id = adminId AND reminder_number = reminderNumber

  IF existing:
    UPDATE sms_templates SET message_template = messageTemplate WHERE id = existing.id
    RETURN existing
  ELSE:
    INSERT INTO sms_templates (admin_id, reminder_number, message_template)
    RETURN new record
```

## Algorithm: getMessage (used by SMS sender and Reminder)

```
FUNCTION getMessage(adminId, reminderNumber, company, link, optout):
  template = SELECT FROM sms_templates
    WHERE admin_id = adminId AND reminder_number = reminderNumber

  IF template:
    text = template.message_template
  ELSE:
    text = DEFAULT_TEMPLATES[reminderNumber]

  RETURN text
    .replace('{company}', company)
    .replace('{link}', link)
    .replace('{optout}', optout)
```
