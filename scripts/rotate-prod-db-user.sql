-- Rotate production DB credentials safely
-- Usage: run these steps as a privileged DB user (root) on your MySQL server.
-- Replace placeholders: <NEW_USER>, <NEW_PASSWORD>, <APP_DB>, <APP_USER_HOST>, <OLD_USER>

-- 1) Create a new application user (do NOT drop the old user yet)
CREATE USER IF NOT EXISTS '<NEW_USER>'@'<APP_USER_HOST>' IDENTIFIED BY '<NEW_PASSWORD>';

-- 2) Grant minimal required privileges to the new user on the application database
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES
  ON `<APP_DB>`.* TO '<NEW_USER>'@'<APP_USER_HOST>';

FLUSH PRIVILEGES;

-- 3) (Optional) Verify privileges
-- SHOW GRANTS FOR '<NEW_USER>'@'<APP_USER_HOST>';

-- After you update your production environment to use the new credentials and verified everything,
-- revoke the old user's privileges and optionally drop it:

-- REVOKE ALL PRIVILEGES, GRANT OPTION FROM '<OLD_USER>'@'<APP_USER_HOST>';
-- DROP USER IF EXISTS '<OLD_USER>'@'<APP_USER_HOST>';
-- FLUSH PRIVILEGES;

-- Alternative: rotate password in-place for existing user
-- ALTER USER '<OLD_USER>'@'<APP_USER_HOST>' IDENTIFIED BY '<NEW_PASSWORD>';
-- FLUSH PRIVILEGES;
