# Production Deployment Checklist

Purpose: a step-by-step checklist to perform a production deployment and rotate DB credentials with minimal risk.

Recommended maintenance window (picked):
- Date: Saturday, May 9, 2026
- Time: 02:00–04:00 (server local time)
- Window length: 2 hours (adjust if your org requires longer)

Pre-deployment (T minus 24–72 hours)
- [ ] Announce maintenance window to stakeholders and on-call team; include expected impact and rollback plan.
- [ ] Ensure runbook and contact list are up-to-date (on-call, DB admin, release owner).
- [ ] Ensure CI/CD credentials and secrets owners are available during the window.
- [ ] Confirm that automated tests (unit/integration) on main branch are green.

Pre-deployment (T minus 2 hours)
- [ ] Take a full DB backup and record filename/location. Command:
  - `npm run db:backup` (JSON fallback) or `mysqldump` for SQL:
    - `mysqldump -h $DB_HOST -P $DB_PORT -u $ROOT_USER -p --single-transaction --routines --triggers $DB_NAME > prod-backup.sql`
- [ ] Verify backup integrity (inspect size, attempt a quick restore to staging if possible).
- [ ] Verify the new DB credentials are created (or plan to create) and stored in secret manager per `docs/ROTATE_DB_CREDENTIALS.md`.
- [ ] Prepare migration and rotate scripts: `scripts/rotate-prod-db-user.sql` and `docs/ROTATE_DB_CREDENTIALS.md` available in the repo.

Deployment steps (during the window)
- [ ] Put the app into maintenance mode (disable writes or show maintenance banner) if supported.
- [ ] Create new DB user (or rotate password) as documented in `scripts/rotate-prod-db-user.sql`.
- [ ] Store new credentials in the production secret store (e.g., GitHub Actions Secrets, Secret Manager).
- [ ] Update deployment manifests / env to reference the new secret values (without removing old secret yet).
- [ ] Deploy application (rolling update / canary preferred).
- [ ] Run basic smoke tests against the deployed instance(s): `node scripts/smoke_test.js`.
- [ ] Run health checks and synthetic transactions (login, list machines, create booking).

Verification (immediately post-deploy)
- [ ] Confirm application logs show successful DB connection and no authentication errors.
- [ ] Confirm critical flows work and data is being written to DB as expected.
- [ ] Monitor metrics and logs for 30–60 minutes for error spikes or regressions.

Post-verification (after monitoring)
- [ ] Revoke old DB user credentials and drop the old user per `scripts/rotate-prod-db-user.sql`.
- [ ] Remove or rotate any secondary copies of the old secret (CI, monitoring, third-party integrations).
- [ ] Update documentation and record rotation details (who, when, backup filename, new user name).
- [ ] Announce completion to stakeholders and close the maintenance ticket.

Rollback procedure (if issues detected)
- [ ] Reintroduce the old secret to the environment and redeploy the previous release or reconfigure the app to use the old credentials.
- [ ] If the old user was dropped, recreate it from the saved SQL (use the backup to restore state if necessary).
- [ ] Escalate to DB admin and engineering leads, provide logs and error details.

Notes & recommendations
- Prefer creating a new DB user over in-place password change (reduces risk) and allows quick rollback.
- Keep changes as atomic as possible: update secrets first, then deploy.
- If you run a clustered deployment, roll out in small batches and verify each batch.
- If possible, use transient canaries and promote only when checks pass.

Files referenced
- `scripts/rotate-prod-db-user.sql`
- `docs/ROTATE_DB_CREDENTIALS.md`
- `docs/ROTATE_GCP_SERVICE_ACCOUNT.md`
