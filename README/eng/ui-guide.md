# ReviewHub UI Guide

## Admin Panel

### Navigation

Sidebar with sections:
- **Dashboard** — main page with analytics
- **Clients** — client database management
- **Reviews** — view received reviews
- **Settings** — company profile
- **Logout** — end session

### Dashboard Page (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  ReviewHub                            [7d] [30d] [90d]  │
├──────────┬──────────┬──────────┬────────────────────────┤
│ SMS Sent │ Reviews  │Conversion│ Avg Rating             │
│ 150      │ 45       │ 30%     │ 4.2                    │
├──────────┴──────────┴──────────┴────────────────────────┤
│ Positive: 35             Negative: 10                   │
├─────────────────────────────────────────────────────────┤
│ Reviews by Day                                          │
│ ██                                                      │
│ ████                                                    │
│ ██████                                                  │
│ ████                                                    │
│ 01   02   03   04   05   06   07                        │
└─────────────────────────────────────────────────────────┘
```

### Clients Page (`/clients`)

```
┌─────────────────────────────────────────────────────────┐
│ Clients                      [Search...]  [+ Add]       │
├─────────────────────────────────────────────────────────┤
│ Name            │ Phone          │ Actions              │
│─────────────────┼────────────────┼──────────────────────│
│ Ivan Petrov     │ +7900****567   │ [SMS] [Delete]       │
│ Maria Sidorova  │ +7900****543   │ [SMS] [Delete]       │
├─────────────────────────────────────────────────────────┤
│                    [< 1 2 3 >]                          │
└─────────────────────────────────────────────────────────┘
```

### Reviews Page (`/reviews`)

```
┌─────────────────────────────────────────────────────────┐
│ Reviews                  [All] [Positive] [Negative]    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 5 stars  Positive                       2026-03-11  │ │
│ │ Great service, highly recommend!                    │ │
│ │ → Routed to Yandex Maps                            │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 2 stars  Negative                       2026-03-10  │ │
│ │ Long wait, quality was poor.                        │ │
│ │ Promo code: RH-A1B2C3D4                            │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    [< 1 2 3 >]                          │
└─────────────────────────────────────────────────────────┘
```

### Settings Page (`/settings`)

```
┌─────────────────────────────────────────────────────────┐
│ Company Settings                                        │
├─────────────────────────────────────────────────────────┤
│ Company Name:                                           │
│ [Dental Clinic "Smile"                            ]     │
│                                                         │
│ Yandex Maps Link:                                       │
│ [https://yandex.ru/maps/org/smile/123456789/      ]    │
│                                                         │
│ Discount (%):                                           │
│ [10                                               ]     │
│                                                         │
│ Discount Text:                                          │
│ [Discount on your next visit                      ]     │
│                                                         │
│                                [Save]                   │
└─────────────────────────────────────────────────────────┘
```

## PWA Review Form (Mobile)

### Form Screen

```
┌───────────────────────┐
│                       │
│   Dental Clinic       │
│   "Smile"             │
│                       │
│   Rate our service    │
│                       │
│   ☆ ☆ ☆ ☆ ☆           │
│                       │
│   ┌─────────────────┐ │
│   │ Write a review  │ │
│   │                 │ │
│   │                 │ │
│   └─────────────────┘ │
│                       │
│   [   Submit    ]     │
│                       │
│   10% off your        │
│   next visit!         │
│                       │
└───────────────────────┘
```

### Result Screen (Positive)

```
┌───────────────────────┐
│                       │
│   Thank you!          │
│                       │
│   Leave your review   │
│   on Yandex Maps      │
│                       │
│   [Open Yandex        │
│    Maps        →]     │
│                       │
└───────────────────────┘
```

### Result Screen (Negative)

```
┌───────────────────────┐
│                       │
│   Thank you for       │
│   your feedback!      │
│                       │
│   Your promo code:    │
│   ┌─────────────────┐ │
│   │  RH-A1B2C3D4    │ │
│   └─────────────────┘ │
│                       │
│   10% off your        │
│   next visit          │
│                       │
└───────────────────────┘
```

## Design System

- **CSS Framework:** Tailwind CSS
- **Components:** Shadcn/ui (admin panel)
- **Icons:** Lucide React
- **Font:** System stack (sans-serif)
- **Colors:** Light theme, Tailwind accents
- **Responsive:** Mobile-first for PWA, desktop-first for admin panel
