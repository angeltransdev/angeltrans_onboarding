# Asset management

HR admins and owners can manage assets from the Assets navigation item. Assets can be retired instead of deleted. Vehicle forms show VIN and license plate; other categories omit these fields while retaining any existing values. After saving an asset, use Add Document / Due Date to choose a record type and add a name, due date, and optional document link. The form suggests types for the selected asset category but permits all supported record types. Each asset may have multiple records for registrations, insurance, permits, inspections, certifications, maintenance, or other due dates. Mark records resolved when no longer needed, or update the due date when renewed. Google Drive or Google Docs links are references only; document access is controlled by Google, not this portal.

The Needs Attention section shows open records due within 30 days or overdue, excluding retired assets. Calendar dates use America/Los_Angeles.

## Database migration

Before deploying the new API, back up the target PostgreSQL database and run `npm run migrate:assets` from the server directory with `DATABASE_URL` set to the intended database. The migration is repeatable and creates the asset, record, and reminder-delivery tables. The API requires these tables; it does not create them automatically.

## Reminder worker

The production Railway project has a separate `asset-reminders` service with start command `npm run remind:assets` and cron schedule `0 * * * *` (hourly, UTC). Its `DATABASE_URL`, `RESEND_API_KEY`, `FROM_EMAIL`, and `HR_EMAIL` reference the corresponding API service variables. The job must be scheduled separately; starting the API alone does not send reminders. Configure Railway alerts for failed jobs and verify successful runs in the service logs.

The reminder service is deployed independently from a minimal directory containing `package.json`, `package-lock.json`, `jobs/assetReminders.js`, `models/db.js`, and `utils/assetReminders.js`. It is not automatically updated by Git pushes. To update the worker, copy those tracked files into a temporary directory preserving their subdirectories, then run `railway up <temporary-directory> --path-as-root --service asset-reminders` from the linked project. Do not copy `.env`, `node_modules`, or `server/railway.json`: that config starts the web API rather than the reminder job. Confirm the cron schedule and start command in Railway after deployment.

The worker sends to `HR_EMAIL` and all non-terminated owner accounts, deduplicating addresses. It sends once per recipient at 30, 14, 7 and 0 days before the date; if a scheduled run is missed, the next run sends only the most recent applicable stage, including the due-day stage for overdue items. Resolved records and retired assets are skipped. A database lock prevents overlapping workers and sent deliveries are recorded so reruns retry only failed deliveries. Resend idempotency keys protect against retries after a send succeeds but before it is recorded, within Resend's idempotency window. A successful provider request is not proof of final mailbox delivery. If the scheduled service is disabled or unavailable, reminders cannot be guaranteed; overdue items remain visible in the dashboard.

## Tests

Run `npm run test:assets` in the server directory. The PostgreSQL integration test is skipped unless `ASSET_TEST_DATABASE_URL` points to an isolated local PostgreSQL database; it creates and drops a test schema. It must not be pointed at a shared or production database.