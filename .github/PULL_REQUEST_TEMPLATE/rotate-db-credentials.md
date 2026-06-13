## Rotate Production DB Credentials — PR Template

Use this template when creating a PR to rotate production database credentials. Link the rotation ticket/issue and follow the checklist carefully. Do not merge until all verification steps pass and a rollback plan is documented.

### PR title
Rotate production DB credentials: create `<new-db-user>` and update secrets

### Related issue / ticket
- Issue: #<number> or link to ticket

### What changed
- Created new DB user and granted privileges (SQL in `scripts/rotate-prod-db-user.sql`).
- Updated deployment secret references to use the new user (do not merge secret values into code).
- Updated docs: `docs/ROTATE_DB_CREDENTIALS.md` describes the procedure.

### Checklist (must be completed before merge)
- [ ] I have created a full production DB backup and attached the backup name/location to the ticket.
- [ ] I have created a new DB user in a maintenance window (see `scripts/rotate-prod-db-user.sql`) and saved the SQL used in this PR comments.
- [ ] I have stored the new DB credentials in the production secrets store (GitHub Actions Secrets / Secret Manager) and documented where.
- [ ] I have updated deployment manifests (Kubernetes secret, Cloud Run env, VM env, etc.) to reference the new secret but have NOT removed the old secret yet.
- [ ] I have deployed the application to a canary environment (or non-prod replica of prod) and run smoke tests successfully there.
- [ ] I have deployed the change to production and confirmed the app can connect and perform read/write operations.
- [ ] I have run the project's smoke tests against production endpoints and confirmed success.
- [ ] I have coordinated with the on-call/ops team and scheduled the deletion of the old DB user after verification.

### Verification steps (to run after deploy)
1. Confirm app logs show successful DB connections and no authentication errors.
2. Run the project's smoke test: `node scripts/smoke_test.js` (from a runner with access to prod API/DB).
3. Sanity-check a few user flows in production (login, listing machines, create booking) and verify DB writes appear.

### Rollback plan
- If the new credentials fail, re-add old credentials to the production secrets store and revert the deployment to use them, or re-create the old DB user and password as documented.

### Post-merge actions (after verification)
- [ ] Revoke and drop the old DB user using the commands in `scripts/rotate-prod-db-user.sql`.
- [ ] Remove any local copies of credentials and update documentation.
- [ ] Record rotation details in the rotation log (who, when, old user, new user, backup file).

### Notes
- Do not store plaintext passwords in this PR. Use secret stores and reference them in deployment manifests.
- If you need automation to create the secret in GitHub, coordinate with the repo owner and use `gh` with caution.
