## PR: Update deployment manifests to use new secret names

Use this PR to update production deployment manifests so they reference new secret names for rotated DB credentials.

### Summary
- Replace direct credential references with secret references using the new secret names.
- Files added/changed: `deploy/k8s/deployment.yaml`, `deploy/docker-compose.prod.yml` (placeholders included).

### What to review
- Ensure the placeholder secret names (`<PROD_DB_SECRET_NAME>`, `<PROD_JWT_SECRET_NAME>`) are replaced with the actual secret resource names used in your environment.
- Verify that RBAC/ServiceAccount permissions allow the deployed service to access the secrets.

### Verification steps
1. Do not merge until a maintenance window is scheduled.
2. Create the new secrets in your secret manager (or Kubernetes secrets) and DO NOT delete the old secrets yet.
3. Deploy to staging/canary and run `node scripts/smoke_test.js`.
4. Promote to production and run smoke tests.

### Rollback
- Revert manifest changes or reinsert old secret names and redeploy if necessary.

### Notes
- This PR intentionally does not include secret values. Add values in your secret store after PR approval.
