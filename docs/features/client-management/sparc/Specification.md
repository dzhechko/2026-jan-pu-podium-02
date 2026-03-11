# Specification: Client Management

## API Endpoints

### GET /api/clients
- **Auth**: Bearer token required
- **Query**: `{ page: int, limit: int, search?: string }`
- **Output 200**: `{ data: Client[], meta: { total, page, limit } }`

### POST /api/clients
- **Auth**: Bearer token required
- **Input**: `{ name: string, phone: string, email?: string }`
- **Output 201**: `{ data: Client }`
- **Output 400**: Validation error

### POST /api/clients/import
- **Auth**: Bearer token required
- **Input**: multipart/form-data `{ file: CSV }`
- **Output 200**: `{ imported: number, skipped: number, errors: string[] }`
- **Constraints**: Max 10MB file size

### DELETE /api/clients/:id
- **Auth**: Bearer token required
- **Output 204**: No content

## Client Object
```json
{
  "id": "uuid",
  "name": "string",
  "phone": "+7XXXXXXXXXX",
  "email": "string | null",
  "opted_out": false,
  "created_at": "ISO 8601"
}
```

## Validation Rules
- name: min 1 char
- phone: regex `^\+7\d{10}$`
- email: valid email format (optional)
- CSV: columns `name,phone,email`

## Security
- Phone/email encrypted at rest with AES-256-GCM
- Decrypted only when returned to authenticated admin
- Phone masked in SMS logs (first 4 + last 2 digits)
