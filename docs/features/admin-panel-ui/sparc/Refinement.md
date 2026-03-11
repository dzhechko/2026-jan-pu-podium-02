# Refinement: Admin Panel UI

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Token expired while on page | Auto-refresh, if fail → redirect to login |
| 2 | Refresh token expired | Redirect to login, clear state |
| 3 | API server down | Error boundary / error messages |
| 4 | Empty client list | Show "Нет клиентов" message |
| 5 | Empty review list | Show "Нет отзывов" message |
| 6 | Registration with existing email | Show error from API |
| 7 | Slow API response | Loading spinners on all data-dependent views |
| 8 | Browser back/forward | React Router handles, auth check on Layout |
| 9 | Direct URL access without auth | Redirect to /login |
| 10 | Multiple tabs with different auth | localStorage sync (potential issue) |

## Security Considerations

- Tokens stored in localStorage (XSS risk — mitigated by CSP headers)
- No sensitive data cached in browser beyond tokens
- API client never logs tokens
- CORS restricts API access to admin domain only

## Testing Strategy

### Unit Tests
- useAuth hook: login/logout state management
- apiClient: token injection, refresh flow
- extractYandexOrgId (if used in frontend)

### Integration Tests
- Login flow: submit → token stored → redirect
- Protected routes: no token → redirect to login
- Dashboard: loads stats via API
- Clients: add, delete, search, paginate

### E2E Tests (Playwright)
- Register → login → see dashboard
- Add client → send SMS → see review request
- Settings: update Yandex URL → save → verify

## Accessibility

- Form labels associated with inputs
- Keyboard navigation (tab order)
- Error messages announced
- Color contrast: Tailwind defaults meet WCAG AA
