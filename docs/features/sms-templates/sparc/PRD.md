# PRD: Custom SMS Templates

## Overview
Admin-customizable SMS text for initial message and each reminder step (0-4). Supports placeholders: {company}, {link}, {optout}. Default templates provided.

## User Stories
- **US-008:** As Admin, I want to customize SMS templates per reminder step

## Requirements
1. CRUD API for SMS templates (create/update, list, delete)
2. Template per reminder number (0=initial, 1-4=reminders)
3. Placeholders: {company}, {link}, {optout}
4. Default fallback when no custom template exists
5. Preview before save
6. Opt-out link mandatory in every template (152-ФЗ)

## Success Metrics
- Admins can personalize SMS messages
- Higher SMS→review conversion through A/B testing different messages
