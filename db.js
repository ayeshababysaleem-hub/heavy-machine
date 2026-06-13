require('dotenv').config();
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'heavy_machine'
  }
});

// test connection
knex.raw('SELECT 1')
  .then(() => console.log('DB Connected ✅'))
  .catch(err => console.error('Connection Error ❌', err));
// Helpful hint for common errors
knex.on('error', (e) => {
  if (e && e.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('\nHelpful fix: create the database and grant access to the configured user:');
    console.error("Run the following in your MySQL shell as a privileged user (root):\n");
    console.error("  CREATE DATABASE IF NOT EXISTS "+(process.env.DB_NAME||'heavy_machine')+";\n  CREATE USER IF NOT EXISTS '"+(process.env.DB_USER||'appuser')+"'@'localhost' IDENTIFIED BY '<password>';\n  GRANT ALL PRIVILEGES ON "+(process.env.DB_NAME||'heavy_machine')+".* TO '"+(process.env.DB_USER||'appuser')+"'@'localhost';\n  FLUSH PRIVILEGES;\n");
    console.error("Or update your .env to the correct DB credentials (DB_USER/DB_PASSWORD).\n");
  } else if (e && e.code === 'ER_BAD_DB_ERROR') {
    console.error('\nThe configured database does not exist. Create it or update DB_NAME in .env.');
  }
});

module.exports = knex;