# PRD: Admin Panel UI

## Overview
Full React admin panel with dashboard, clients, reviews, and settings pages. Uses React Router, TanStack Query for server state, and Tailwind CSS for styling.

## Pages
1. **Login/Register** — auth forms
2. **Dashboard** — analytics overview (charts, stats)
3. **Clients** — client list, add client, CSV import, send SMS
4. **Reviews** — review list with sentiment filter
5. **Settings** — company profile, Yandex Maps URL, discount config

## Navigation
- Sidebar layout with nav links
- Auth-protected routes (redirect to login if no token)
- JWT token stored in localStorage

## Components
- Layout (sidebar + content area)
- AuthProvider (context for token management)
- API client (fetch wrapper with auth headers)
