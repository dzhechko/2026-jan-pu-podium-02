# Pseudocode: Client Management

## Encryption Service
```
FUNCTION encrypt(plaintext, key):
  1. Generate random 12-byte IV
  2. Create AES-256-GCM cipher with key and IV
  3. Encrypt plaintext
  4. Return IV + authTag + ciphertext as hex string

FUNCTION decrypt(encrypted, key):
  1. Extract IV (first 12 bytes), authTag (next 16 bytes), ciphertext
  2. Create AES-256-GCM decipher with key, IV, authTag
  3. Decrypt and return plaintext
```

## Create Client
```
FUNCTION createClient(admin_id, { name, phone, email }):
  1. Validate input
  2. Encrypt phone with AES-256-GCM
  3. If email provided, encrypt email
  4. Check for duplicate phone (by encrypted value match — store phone hash for lookup)
  5. Create client record
  6. Return client with decrypted fields
```

## List Clients
```
FUNCTION listClients(admin_id, { page, limit, search }):
  1. Query clients for admin_id with pagination
  2. Decrypt phone/email for each client
  3. If search: filter by decrypted name (DB ILIKE) or phone match
  4. Return paginated results with meta
```

## CSV Import
```
FUNCTION importClients(admin_id, csvFile):
  1. Validate file size <= 10MB
  2. Parse CSV rows (expected: name, phone, email)
  3. For each row:
     a. Validate phone format
     b. Encrypt phone/email
     c. Attempt insert (skip duplicates)
  4. Return { imported, skipped, errors }
```

## Module Structure
```
packages/api/src/modules/clients/
├── schema.ts    — Zod validation
├── service.ts   — ClientsService
└── routes.ts    — CRUD endpoints

packages/api/src/services/
└── encryption.ts — AES-256-GCM encrypt/decrypt
```
