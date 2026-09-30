# Apps Script → Node.js Migration Runbook

## 1. Freeze and back up the current application

Before cutover, stop configuration changes and obtain a complete copy/export of the Google Sheets backend. Keep the Apps Script deployment available in read-only/support mode until reconciliation is complete.

## 2. Export the backend sheets

Export the application sheets to CSV using their exact sheet names. The Node migration utility recognizes the legacy schema directly.

## 3. Configure the Node.js environment

Create `.env` from `.env.example`. Set Google OAuth credentials, secrets, public URL, database path, and the bootstrap Admin email.

## 4. Initialize and import

Start the application once so the SQLite schema is initialized, stop it, then run:

```bash
npm run import-gas -- /path/to/csv-export
```

Create a backup immediately after import:

```bash
npm run backup -- ./backups/post-import.sqlite
```

## 5. Reconcile

Compare at minimum:

- counts by Contractors, Crews, CrewMembers and Users;
- worksheet count and WorksheetJobs count;
- open Exceptions count;
- monthly completed jobs and required jobs;
- duplicate-job exceptions;
- representative overnight timing calculations;
- Contractor user scoping and AuthorizedParishes;
- contractor-specific XLSX template contents.

## 6. OAuth test

Verify an Admin, Superuser and Contractor login. Confirm the authenticated email maps to the expected Users record and that Contractor users cannot access another contractor's data.

## 7. Bulk-import test

Download a fresh contractor-bound XLSX, submit a small controlled batch, then submit a second matching batch. Confirm both imports resolve to one logical worksheet and duplicates do not inflate Jobs Completed.

## 8. Cutover

Update the production DNS/reverse proxy to the Node service, monitor `/api/health`, and keep the legacy export and pre-cutover database backup under retention controls.
