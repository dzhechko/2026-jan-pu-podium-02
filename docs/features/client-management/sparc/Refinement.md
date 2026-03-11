# Refinement: Client Management

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Duplicate phone for same admin | DB error caught, skip in import / 400 on create |
| 2 | CSV with no header | Auto-detect: if first row has "name", skip it |
| 3 | CSV with empty rows | Skip empty lines |
| 4 | CSV exceeds 10MB | 400 validation error |
| 5 | CSV with wrong delimiter | Best-effort comma split |
| 6 | Invalid phone in CSV row | Skip row, add to errors array |
| 7 | Delete client with existing reviews | CASCADE delete via FK |
| 8 | Search with special chars | Prisma ILIKE escaping handles it |
| 9 | Corrupted encryption key | decrypt() throws, 500 error |
| 10 | Client opted_out, try to delete | Allowed — admin can still delete |

## Security (152-ФЗ)

- Phone numbers stored only as AES-256-GCM encrypted BYTEA
- Encryption key from environment variable, never committed
- Decryption happens only for authenticated admin's own clients
- Deleted clients: data physically removed (CASCADE)

## Testing Strategy

### Unit Tests
- EncryptionService: encrypt → decrypt roundtrip
- EncryptionService: different IVs for same plaintext
- ClientsService.create: valid input → encrypted storage
- ClientsService.list: returns decrypted data
- ClientsService.importCsv: valid CSV → imported count
- ClientsService.importCsv: invalid rows → skipped + errors

### Integration Tests
- POST /api/clients → 201
- GET /api/clients → 200 paginated
- GET /api/clients?search=name → filtered
- DELETE /api/clients/:id → 204
- POST /api/clients/import → { imported, skipped }
- All endpoints without auth → 401

## Performance

- Encryption: ~0.1ms per phone (AES-256-GCM is hardware-accelerated)
- CSV import: sequential inserts (could batch for >1000 rows)
- Pagination: DB-level OFFSET/LIMIT with COUNT
