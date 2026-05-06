# Rotate Production MySQL Credentials (Safe Procedure)

This document describes a safe, testable process to rotate the database credentials used by the application in production.

Important: do not delete or revoke the old credentials until you have fully verified the new credentials work in all consumers (app, CI, workers, scheduled jobs).

Prerequisites
- Privileged access to the MySQL server (root or an account with `CREATE USER`, `GRANT`, `ALTER USER`, `DROP USER` privileges).
- Access to your production secrets store (e.g., GitHub Actions Secrets, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager).
- A tested backup of the production database (see `scripts/backup-db.js`).

High-level steps
1. Backup the database.
2. Create a new DB user (or rotate password in-place).
3. Grant the minimum required privileges to the new user.
4. Update production secrets to the new credentials.
5. Deploy or reload the application so it picks up the new secret.
6. Run smoke tests and health checks.
7. Revoke and remove the old credentials.

Detailed step-by-step

1) Create a full database backup (required)

Use the project backup utilities or `mysqldump`.

Node fallback JSON backup (cross-platform):

```bash
npm run db:backup
# outputs file under backups/backup-json-YYYYMMDDTHHMM.json
```

If you have `mysqldump` installed and prefer SQL dumps:

```bash
mysqldump -h <DB_HOST> -P <DB_PORT> -u <ROOT_USER> -p --single-transaction --routines --triggers <DB_NAME> > prod-backup.sql
```

2) Create a new application user (recommended approach)

Open a secure MySQL session as a privileged user and run the SQL in `scripts/rotate-prod-db-user.sql`, replacing placeholders.

Example (shell):

```bash
mysql -h PROD_DB_HOST -u root -p
-- inside mysql shell
SOURCE scripts/rotate-prod-db-user.sql;
```

Replace placeholders at top of the SQL file before running:
- `<NEW_USER>`: new username (e.g. `app_user_v2`)
- `<NEW_PASSWORD>`: strong random password (rotate and store securely)
- `<APP_DB>`: your application database name (e.g. `heavy_machine`)
- `<APP_USER_HOST>`: host pattern allowed for app (e.g. `%` or `10.0.0.%`)
- `<OLD_USER>`: current app user (for later revocation)

Alternative: rotate password in-place

If you cannot create a new user, change the existing user's password atomically:

```sql
ALTER USER 'app_user'@'%' IDENTIFIED BY '<NEW_PASSWORD>';
FLUSH PRIVILEGES;
```

3) Store the new credentials in your secrets manager

- GitHub Actions example (use `gh` or set via UI):

```bash
gh secret set DB_PASSWORD --body "<NEW_PASSWORD>" --repo <owner>/<repo>
gh secret set DB_USER --body "<NEW_USER>" --repo <owner>/<repo>
```

- For other secret stores, follow their secure-update procedures. Avoid committing secrets to the repo.

4) Update production environment and deploy

- Update the environment variables or secret references in your deployment configuration (Cloud Run, VM, Docker Compose, Kubernetes Secret, etc.).
- Restart/redeploy the application so the process picks up the new credentials.

5) Verification / smoke tests

- Run health checks and the project's smoke test suite (register/login/list/create booking).
- Example (after deploy):

```bash
# from within an environment that can reach production DB/API
npm run db:backup # optional quick check
node scripts/smoke_test.js
```

Look for successful responses and that the app can read/write expected tables.

6) Revoke the old credentials (only after verification)

Once all consumers are verified to work with the new credentials, revoke and delete the old user:

```sql
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '<OLD_USER>'@'<APP_USER_HOST>';
DROP USER IF EXISTS '<OLD_USER>'@'<APP_USER_HOST>';
FLUSH PRIVILEGES;
```

7) Post-rotation housekeeping

- Remove local copies of any JSON key or passwords that were written to disk.
- Rotate any other places that used the same DB credentials (CI runners, monitoring, scheduled tasks).
- Document the rotation event: time, user who performed it, new user name, secrets updated, rollback plan.

Rollback plan

- If something breaks after rotation, you can:
  - Recreate the old user with the previous password (if you documented it), or
  - Recreate a key and update consumers to point back temporarily while troubleshooting.

Security recommendations

- Use least-privilege principals and avoid `GRANT ALL` to the application user.
- Use network-level restrictions on the DB user host pattern where feasible.
- Prefer managed secret stores and rotate credentials regularly (e.g., every 90 days).

If you want, I can:
- (A) generate a one-shot script that: creates a new user, stores the secret in GitHub Actions (using `gh`), and outputs the PR/commands you can apply; or
- (B) produce a PR template/checklist you can use in your repo when rotating credentials.
