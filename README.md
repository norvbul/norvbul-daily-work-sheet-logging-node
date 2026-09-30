# Daily Work Sheet Logging — Node.js Edition

Production-oriented Node.js conversion of the Google Apps Script Daily Work Sheet Logging application for Emergency & Dispatch Operations. The user workflow, RBAC model, compliance rules, logical worksheet merging, duplicate handling, bulk XLSX generation, reports, legal/information pages, and Qwik Business Solutions attribution are retained.

## Architecture

- **Runtime:** Node.js 22+
- **HTTP server:** Node.js native `http` module; no third-party server framework is required.
- **Database:** SQLite through Node's built-in `node:sqlite`, using WAL mode and automatic schema initialization/migration.
- **Frontend:** the existing React UI is preserved and served as a same-origin SPA. `google.script.run` has been replaced with a JSON RPC endpoint at `/api/rpc`.
- **Authentication:** Google OAuth 2.0 / OpenID Connect in production, with optional Google Sheets read scope. A guarded local development mode is available.
- **Sessions:** random opaque session IDs, SHA-256 hashes stored in SQLite, HttpOnly/SameSite cookies, and AES-256-GCM encryption for stored Google access/refresh tokens.
- **Bulk imports:** Excel/CSV remains browser parsed; Google Sheets import is server-side through the Google Sheets API. Import merging uses the logical worksheet identity `Contractor + Date Worked + Crew + Shift + Work Type + Parish`.
- **DevOps:** Dockerfile, Compose file, health endpoint, Nginx example, systemd unit, backup utility, CSV migration utility, and GitHub Actions CI.

## Feature parity

The Node.js edition provides the same core application areas:

- Admin / Superuser / Contractor RBAC
- contractor and Authorized Parish scoping
- dashboard KPI cards and rules-based AI Insights
- daily worksheet entry and editing
- minimum completed jobs per shift (default 6)
- assigned → on-site → completed chronology and overnight handling
- 15-minute timing-compliance checks inside the application
- configurable duration-overrun warnings
- data completeness and weighted overall compliance
- duplicate Job ID detection and unique-job production counting
- exceptions and exception review
- Excel, CSV and Google Sheets bulk import
- repeated-import logical worksheet merging
- contractor-bound protected XLSX templates and crew-member validation
- filterable reports and CSV export
- administration for Users, Contractors, Crews, CrewMembers, Parishes, Shifts, WorkTypes, Settings and LegalContent
- About, Licensing, Disclaimer and Copyright pages
- audit logging and import-batch traceability

## Quick start — local development

Node.js 22.5+ is required. There are no external npm runtime dependencies.

```bash
cp .env.example .env
```

For local development, set:

```env
NODE_ENV=development
AUTH_MODE=dev
DEV_USER_EMAIL=admin@example.com
DEV_USER_NAME=Local Admin
DATABASE_PATH=./data/dws.sqlite
COOKIE_SECURE=false
```

Then run:

```bash
npm run check
npm test
npm run dev
```

Open `http://localhost:8080`.

On the first start in dev mode, the development user is bootstrapped as an Admin if the Users table is empty.

## Production authentication with Google

Set these environment variables:

```env
NODE_ENV=production
AUTH_MODE=google
APP_BASE_URL=https://dws.example.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://dws.example.com/auth/google/callback
SESSION_SECRET=<32+ random characters>
SESSION_ENCRYPTION_KEY=<64 hex characters>
COOKIE_SECURE=true
BOOTSTRAP_ADMIN_EMAIL=your.admin@company.com
```

Register the same redirect URI in Google Cloud OAuth configuration. If `GOOGLE_SHEETS_SCOPE=true`, the login also requests read-only Google Sheets access so the Google Sheets import feature can operate on spreadsheets the user can read.

The authenticated email must exist as an active record in **Administration → Users**. `BOOTSTRAP_ADMIN_EMAIL` is used only to seed the first Admin when the Users table is empty.

## Database

The default path is `./data/dws.sqlite`. Production Docker defaults to `/app/data/dws.sqlite`.

The server automatically:

1. creates missing tables;
2. adds missing columns from the current schema;
3. enables WAL and foreign-key processing;
4. seeds Settings, Jamaica parishes, Shifts, WorkTypes and detailed LegalContent;
5. optionally bootstraps the first Admin.

The application intentionally keeps table/column names aligned with the former Google Sheets schema to make migration and support easier.

### Backup

```bash
npm run backup
```

or choose a path:

```bash
npm run backup -- ./backups/pre-release.sqlite
```

## Migrating data from the Apps Script / Google Sheets edition

Export each backend sheet as CSV into one directory using these names where available:

- `Settings.csv`
- `Users.csv`
- `Contractors.csv`
- `Crews.csv`
- `CrewMembers.csv`
- `Parishes.csv`
- `Shifts.csv`
- `WorkTypes.csv`
- `Worksheets.csv`
- `WorksheetJobs.csv`
- `Exceptions.csv`
- `AuditLog.csv`
- `LegalContent.csv`

Then run:

```bash
npm run import-gas -- /path/to/exported-csvs
```

The importer maps by column header and upserts on the same primary identifiers used by the Apps Script application. Take a database backup before re-running an import against an existing environment.

## Creating another Admin

```bash
npm run create-admin -- admin2@example.com "Admin Two"
```

## Docker deployment

Create `.env`, then:

```bash
docker compose up -d --build
```

The SQLite database is stored in the `dws_data` volume. `./backups` is mounted into the container for backup output.

Health check:

```bash
curl https://dws.example.com/api/health
```

Expected response:

```json
{"ok":true,"version":"2.0.0","database":"sqlite"}
```

## Reverse proxy / TLS

`deploy/nginx.conf` contains a reverse-proxy example. Terminate TLS at Nginx, your cloud load balancer, or another trusted ingress. `APP_BASE_URL` and `GOOGLE_REDIRECT_URI` must use the public HTTPS origin.

When TLS is enabled, keep `COOKIE_SECURE=true`.

## Security notes

- Do not enable `AUTH_MODE=dev` in production.
- Rotate `SESSION_SECRET` and `SESSION_ENCRYPTION_KEY` using your normal secret-management process.
- Restrict filesystem access to the SQLite data and backup directories.
- Back up the database before application upgrades or bulk migrations.
- Excel workbook protection remains an integrity/accidental-edit control, not a trust boundary. The Node.js server revalidates contractor, crew, parish, crew-member, date/time, duplicate, and compliance rules.
- Production decisions should be based on validated records and applicable operating procedures, consistent with the application's Disclaimer page.

## Operational endpoints

- `GET /api/health` — liveness/readiness-style health response
- `GET /api/version` — application version
- `POST /api/rpc` — authenticated application RPC endpoint
- `GET /auth/login` — Google login entry point
- `GET /auth/google/callback` — OAuth callback
- `GET /auth/logout` — destroy session and return to application

## CI

The included GitHub Actions workflow performs:

```text
npm run check
npm test
docker build
```

## Attribution

© 2026 Qwik Business Solutions. All rights reserved, subject to the application's configured legal notices and third-party component licences.
