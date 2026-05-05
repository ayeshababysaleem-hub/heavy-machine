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

module.exports = knex;