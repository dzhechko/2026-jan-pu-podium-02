# Specification: Admin Panel UI

## Pages

### Login (/login)
- Fields: email, password
- Submit → POST /api/auth/login
- Store tokens in localStorage
- Redirect to / on success

### Register (/register)
- Fields: email, password, company_name, phone
- Submit → POST /api/auth/register
- Store tokens, redirect to /

### Dashboard (/ — auth required)
- Period selector (7d/30d/90d)
- 4 stat cards: SMS sent, reviews, conversion, avg rating
- Positive/negative counters
- Reviews by day bar chart
- Data: GET /api/analytics/dashboard

### Clients (/clients — auth required)
- Client table with pagination + search
- Add client form (inline)
- Send SMS button per client
- Delete client button
- Data: GET /api/clients, POST /api/clients, DELETE /api/clients/:id

### Reviews (/reviews — auth required)
- Review cards with star rating, text, sentiment badge
- Sentiment filter (all/positive/negative/neutral)
- Pagination
- Data: GET /api/reviews

### Settings (/settings — auth required)
- Form: company_name, yandex_maps_url, discount_percent, discount_text
- Auto-load current values
- Save button
- Data: GET /api/settings, PUT /api/settings

## Auth Flow
1. Check localStorage for token on app init
2. If token exists → show protected routes
3. If no token → redirect to /login
4. On 401 → try refresh token → if fail → clear + redirect
5. Logout → clear localStorage + redirect

## Routing Structure
```
/ → Layout (sidebar)
  ├── index → Dashboard
  ├── /clients → Clients
  ├── /reviews → Reviews
  └── /settings → Settings
/login → Login (no sidebar)
/register → Register (no sidebar)
```
