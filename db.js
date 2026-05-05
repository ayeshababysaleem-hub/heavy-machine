const knex = require("knex")({
  client: "mysql2",
  connection: {
    host: "127.0.0.1",
    user: "root",
    password: "abc123",
    database: "heavy_machine"
  }
});

// test connection
knex.raw("SELECT 1")
  .then(() => console.log("DB Connected ✅"))
  .catch(err => console.error("Connection Error ❌", err));

module.exports = knex;