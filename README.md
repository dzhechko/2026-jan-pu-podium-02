# ReviewHub

Платформа автоматического сбора и маршрутизации отзывов для российского малого бизнеса. Аналог [Podium](https://www.podium.com/) для российского рынка.

## Что делает

1. **SMS-рассылка** — админ отправляет клиентам запрос на отзыв через SMSC.ru
2. **PWA-форма** — клиент открывает ссылку, ставит оценку и пишет текст
3. **AI-анализ** — LLM анализирует тональность отзыва
4. **Маршрутизация** — позитивные → redirect на Яндекс Карты, негативные → скрытый раздел
5. **Напоминания** — каскад из 4 SMS (2ч → 24ч → 3д → 7д)

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Shadcn/ui
- **Backend:** Node.js 20 + Fastify 4 + Prisma 5
- **Database:** PostgreSQL 16, Redis 7
- **SMS:** SMSC.ru API
- **AI:** Anthropic Claude API
- **Deploy:** Docker Compose on VPS (Russia, 152-ФЗ)

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d postgres redis

# Setup database
cd packages/api && npx prisma migrate dev

# Start development
npm run dev
```

## Documentation

See `docs/` for full SPARC documentation:
- [PRD](docs/PRD.md) — Product Requirements
- [Architecture](docs/Architecture.md) — System Design
- [Specification](docs/Specification.md) — User Stories
- [Development Guide](DEVELOPMENT_GUIDE.md) — Step-by-step lifecycle

## Bilingual Documentation / Двуязычная документация

- [README (Русский)](README/README.ru.md)
- [README (English)](README/README.en.md)

## License

Private
