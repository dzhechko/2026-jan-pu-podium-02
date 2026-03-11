# PRD: Client Management (US-002)

## Overview
CRUD operations for client contacts with AES-256-GCM phone/email encryption at rest. CSV import support.

## User Stories
- **US-002**: As an admin, I can add clients (name, phone, email) for review requests
- **US-002a**: As an admin, I can import clients from CSV file
- **US-002b**: As an admin, I can search/filter/paginate client list
- **US-002c**: As an admin, I can delete a client

## Acceptance Criteria
1. POST /api/clients creates client with encrypted phone/email
2. GET /api/clients returns paginated list with decrypted data
3. POST /api/clients/import parses CSV (name,phone,email columns)
4. DELETE /api/clients/:id removes client record
5. Phone format validated: +7XXXXXXXXXX
6. Duplicate phone per admin returns error
7. CSV max 10MB, validates structure before import
8. All endpoints require JWT authentication
