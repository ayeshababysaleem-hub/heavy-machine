# Rotate GCP Service Account Key (Safe Procedure)

This document describes a safe, testable process to rotate a Google Cloud service account key used by this project. Do not skip the verification steps — rotating a key without updating consumers may break CI, deployments, or runtime services.

Prerequisites
- `gcloud` CLI installed and authenticated with an account that has `iam.serviceAccounts.keys.create` and `iam.serviceAccounts.keys.delete` permissions for the target service account.
- `gh` (GitHub CLI) or access to GitHub UI to update repository secrets (if used).
- Owner/project-id and service account email (example: `my-sa@PROJECT_ID.iam.gserviceaccount.com`).

High-level steps
1. Create a new key for the service account.
2. Store the new key securely (Secret Manager, GitHub Secret, CI secret store).
3. Update all consumers (CI, production env, services) to use the new key.
4. Test and verify successful operation.
5. Revoke and delete the old key.

Detailed commands (example)

Set variables (replace values):

```bash
PROJECT_ID=your-gcp-project-id
SA_EMAIL=service-account-name@${PROJECT_ID}.iam.gserviceaccount.com
NEW_KEY_FILE=new-key.json
SECRET_NAME=proj-gcp-sa-key
```

Create a new JSON key (saved locally as `new-key.json`):

```bash
gcloud iam service-accounts keys create ${NEW_KEY_FILE} --iam-account=${SA_EMAIL} --project=${PROJECT_ID}
```

Secure the key (recommended: use Secret Manager):

```bash
gcloud secrets create ${SECRET_NAME} --replication-policy="automatic" || echo "secret exists"
gcloud secrets versions add ${SECRET_NAME} --data-file=${NEW_KEY_FILE}
```

Update CI (GitHub Actions) secrets (example using `gh`):

```bash
gh secret set GCP_SERVICE_ACCOUNT_KEY --body "$(cat ${NEW_KEY_FILE})" --repo <owner>/<repo>
```

If you use other CI systems (GitLab, CircleCI, Jenkins, etc.), follow their secret-upload procedures and replace the key used by your pipeline.

Update deployed apps / services
- If your production deployment reads the key from an environment variable or secret store, update that secret/source to reference the new key version.
- For Cloud Run / Cloud Functions, prefer Workload Identity over JSON keys. If not possible, update the deployed service to pull the new secret value and restart.

Verify the new key works (local smoke test)

```bash
# activate service account locally (optional test)
gcloud auth activate-service-account --key-file=${NEW_KEY_FILE}
# quick API call test
gcloud projects get-iam-policy ${PROJECT_ID} --format=json >/dev/null && echo "gcloud API OK"

# or run your project's smoke tests that exercise the GCP APIs the service account uses
npm run db:backup && node scripts/smoke_test.js
```

Find and remove the old key

1. List keys for the service account and identify the old key ID(s):

```bash
gcloud iam service-accounts keys list --iam-account=${SA_EMAIL} --project=${PROJECT_ID} --format="value(name)
"
```

2. Delete the old key(s) (example):

```bash
gcloud iam service-accounts keys delete projects/${PROJECT_ID}/serviceAccounts/${SA_EMAIL}/keys/<KEY_ID> --iam-account=${SA_EMAIL} --project=${PROJECT_ID}
```

Note: Use the full resource name returned by the `list` command for `<KEY_ID>`.

Post-rotation checklist
- Confirm CI builds succeed using the new secret.
- Confirm deployments using the new key can access required GCP APIs.
- Remove any local copies of the old/new key from developer machines.
- Revoke and delete the old key from the service account in the GCP Console.
- If the key was committed to the repo, ensure it is removed from history (you already did this). If the key was used in other places (third-party services), update them too.

Rollback plan
- If consumers fail with the new key, you can re-add the old key temporarily (create a new key if deleted) and repoint consumers to the working key while troubleshooting.

Recommendations
- Prefer Workload Identity (short-lived tokens) for Cloud Run/GKE instead of long-lived JSON keys.
- Use Secret Manager for storing keys and reference secrets by version in deployments.
- Document every rotation and notify team members; rotations should be scheduled and tested.

If you want, I can: (A) prepare a small script to create the key and push it to GitHub Actions secrets, or (B) produce a checklist / PR template you can use to perform the rotation safely. Tell me which.
