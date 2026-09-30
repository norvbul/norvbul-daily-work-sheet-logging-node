# Architecture

```text
Browser / React SPA
        |
        | HTTPS / JSON RPC
        v
Node.js HTTP Service
  ├─ Google OAuth / session management
  ├─ RBAC + parish/contractor scoping
  ├─ worksheet/compliance service
  ├─ bulk import + logical worksheet merge
  ├─ reports / dashboard / insights
  ├─ admin configuration
  └─ audit logging
        |
        v
SQLite (WAL)
  Settings / Users / Contractors / Crews / CrewMembers
  Parishes / Shifts / WorkTypes
  Worksheets / WorksheetJobs / Exceptions / AuditLog / LegalContent
```

## Frontend transport conversion

The Apps Script client used `google.script.run`. The Node edition preserves the same high-level method names but sends a same-origin `POST /api/rpc` request containing:

```json
{"method":"getDashboardData","args":[{"month":"2026-09"}]}
```

The server resolves the authenticated user first and then dispatches only to an explicit RPC allow-list.

## Authentication flow

```text
/auth/login
    -> Google OAuth
    -> /auth/google/callback
    -> Google userinfo email
    -> active Users table lookup on next RPC
    -> opaque HttpOnly session cookie
```

Google access and refresh tokens are encrypted with AES-256-GCM before storage. Only a SHA-256 hash of the opaque session identifier is stored in SQLite.

## Data integrity

All worksheet compliance calculations are performed server-side. XLSX validation and workbook protection improve data-entry quality but do not act as the trust boundary.

The server independently validates:

- role and contractor access;
- AuthorizedParishes;
- crew-to-contractor relationship;
- contractor-bound template metadata;
- crew-member assignments for controlled templates;
- dates, timestamps and chronology;
- 15-minute timing exceptions;
- duration overruns;
- required data completeness;
- duplicate Job IDs;
- logical worksheet identity and import merging.

## Scaling note

SQLite WAL is appropriate for the current internal, transactional workload and enables a dependency-free deployment. If future load requires multiple active application replicas sharing one database, migrate the Store layer to PostgreSQL before horizontal scaling. The business service is intentionally separated from the storage layer to make that migration contained.
