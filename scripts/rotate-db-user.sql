-- scripts/rotate-db-user.sql
-- Template to create or rotate a database user and grant privileges.
-- WARNING: replace the placeholders below before running. Do NOT commit secrets.

-- Placeholders to replace:
--   <DB_USER>     - username for the application (e.g. appuser)
--   <DB_PASSWORD> - strong password for the user
--   <DB_HOST>     - allowed host for the user (use '127.0.0.1' for local access or '%' for any host)
--   <DB_NAME>     - database name (e.g. heavy_machine)

-- Example usage (Unix / PowerShell):
--   set the placeholders in the file, then run:
--     mysql -u root -p < scripts/rotate-db-user.sql

-- 1) Create the user if it does not exist (or set password if exists)
CREATE USER IF NOT EXISTS '<DB_USER>'@'<DB_HOST>' IDENTIFIED BY '<DB_PASSWORD>';

-- 2) If the user already exists, ensure the password is updated (safe no-op if same)
ALTER USER '<DB_USER>'@'<DB_HOST>' IDENTIFIED BY '<DB_PASSWORD>';

-- 3) Grant privileges scoped to the application's database (least privilege recommended)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON `<DB_NAME>`.* TO '<DB_USER>'@'<DB_HOST>';

-- 4) Apply changes
FLUSH PRIVILEGES;

-- 5) (Optional) Revoke privileges from an old user (uncomment and modify if needed)
-- REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'olduser'@'127.0.0.1';

-- 6) (Optional) Drop the old user after confirming services are migrated
-- DROP USER 'olduser'@'127.0.0.1';

-- End of script
