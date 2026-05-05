Rotate Google Cloud service account keys

When a service account key may have been exposed (committed to the repo or leaked), rotate keys immediately and remove the old key material from the repository and any systems.

Steps to rotate a Google Cloud service account key (recommended):

1. Identify the service account

   - Determine the exact service account email used in the leaked key (e.g. `my-sa@PROJECT_ID.iam.gserviceaccount.com`).
   - If you have the leaked JSON file, open it and check the `client_email` and `project_id` fields.

2. Revoke the leaked key(s) in the Google Cloud Console (recommended) or via `gcloud`

   - Console: Go to IAM & Admin → Service Accounts → select the service account → Keys tab → Delete the compromised key.
   - gcloud (list keys):

     ```bash
     gcloud iam service-accounts keys list --iam-account=SERVICE_ACCOUNT_EMAIL
     ```

   - gcloud (delete key):

     ```bash
     gcloud iam service-accounts keys delete KEY_ID --iam-account=SERVICE_ACCOUNT_EMAIL
     ```

   Notes:
   - `KEY_ID` is the key's id shown in the list output (not the filename).

3. Create a new key (do not commit it)

   - Create new key (preferred: use `gcloud` and store the JSON securely):

     ```bash
     gcloud iam service-accounts keys create /secure/path/service-account-key.json \
       --iam-account=SERVICE_ACCOUNT_EMAIL
     ```

   - Or create the key in the Console (IAM → Service Accounts → Keys → Add Key → Create new key → JSON) and download it.

4. Secure the new key

   - Move the key to a secure location (vault, secret manager, encrypted storage).
   - Do NOT commit the key to version control.
   - Add the filename pattern to `.gitignore` if not already present (e.g. `serviceAccountKey.*`, `key.json`, `service-account-key.json`).
   - Prefer using Google Secret Manager, Cloud KMS, or environment variables rather than raw JSON files on disk.

5. Update services and CI/CD that use the key

   - Update any services, servers, or CI/CD secrets that depended on the old key to use the new key or a Secret Manager secret.
   - Deploy or restart services as necessary with the new credentials.

6. Verify the new key works

   - Test locally or in a staging environment to confirm authentication works (e.g., run a small `gcloud` or API call that requires the service account).

7. Remove old key material from the repository and history

   - Confirm the old key file is deleted from the working tree.
   - If the key was ever committed, remove it from git history (you already ran history-rewrite tools). If not, run `git filter-repo` (preferred) or `git filter-branch` and then force-push, and coordinate with collaborators.

8. Rotate regularly and audit

   - Consider rotating service account keys periodically and enforce least privilege on the service account.
   - Audit IAM roles assigned to the service account; remove excessive permissions.

Quick commands summary

```bash
# List keys for the service account
gcloud iam service-accounts keys list --iam-account=SERVICE_ACCOUNT_EMAIL

# Delete a specific key by its KEY_ID
gcloud iam service-accounts keys delete KEY_ID --iam-account=SERVICE_ACCOUNT_EMAIL

# Create a new key (downloads JSON to a secure path)
gcloud iam service-accounts keys create /secure/path/service-account-key.json \
  --iam-account=SERVICE_ACCOUNT_EMAIL
```

If you want, I can:
- Add a small script to upload the new key into Google Secret Manager and update environment reference.
- Create a short `secrets.md` explaining how to use Secret Manager with Node apps.
- Scan the repository now for any other potential secret-like files and report them.

Safety note: after rotation, rotate any credentials that may have been stored elsewhere (CI, third-party services), and treat the leaked key as compromised until revoked.