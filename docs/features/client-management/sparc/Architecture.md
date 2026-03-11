# Architecture: Client Management

## Component Diagram

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Admin Panel   │────▶│  Fastify API │────▶│ PostgreSQL │
│ Clients page  │     │              │     │            │
│               │     │ /api/clients │     │ clients    │
└──────────────┘     └──────┬───────┘     └────────────┘
                            │
                     ┌──────┴───────┐
                     │ Clients      │
                     │ Module       │
                     │ schema.ts    │
                     │ service.ts   │──▶ EncryptionService
                     │ routes.ts    │
                     └──────────────┘

┌──────────────────┐
│ EncryptionService│
│ (AES-256-GCM)   │
│                  │
│ encrypt(text)    │ → IV(12) + AuthTag(16) + Ciphertext
│ decrypt(buffer)  │ → plaintext
└──────────────────┘
```

## Encryption Architecture

```
Plaintext phone: "+79001234567"
         ↓
   ┌─────────────┐
   │ Random IV   │ 12 bytes
   │ AES-256-GCM │ key from ENCRYPTION_KEY env
   │ AuthTag     │ 16 bytes (integrity)
   └─────────────┘
         ↓
Stored: Buffer(IV + AuthTag + Ciphertext) → BYTEA in PostgreSQL
```

## Database Schema

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_encrypted BYTEA NOT NULL,
  email_encrypted BYTEA,
  opted_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clients_admin ON clients(admin_id);
```

## CSV Import Flow

```
File upload (multipart) → Buffer
  → Parse CSV lines (skip header if detected)
  → For each row:
     → Validate phone format
     → Encrypt phone + email
     → Insert into DB (skip on duplicate)
  → Return { imported, skipped, errors }
```

## Dependencies

| Package | Purpose |
|---------|---------|
| node:crypto | AES-256-GCM encryption |
| @fastify/multipart | CSV file upload |
| @prisma/client | Database access |
