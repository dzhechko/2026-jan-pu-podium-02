# Refinement: Custom SMS Templates

## Edge Cases
1. Admin has no custom templates → all defaults used (current behavior)
2. Admin sets template for reminder #2 only → #0,1,3,4 use defaults
3. Template with only {link} but no {optout} → rejected (152-ФЗ)
4. Very long template → SMSC splits into multiple SMS (warn but allow)

## Security
- Sanitize template text (no HTML/script injection)
- Admin can only manage own templates (adminId from JWT)
- {optout} mandatory in every message (152-ФЗ compliance)

## Testing
- Unit: upsert logic, validation, placeholder interpolation
- Unit: default fallback when no template
- Integration: full SMS flow with custom templates
