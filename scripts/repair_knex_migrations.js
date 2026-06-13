const knex = require('../db');

async function run(){
  try{
    console.log('Reading knex_migrations table...');
    const rows = await knex('knex_migrations').select('*').orderBy('id');
    if (!rows || rows.length === 0) { console.log('No migrations recorded.'); return process.exit(0); }
    console.table(rows.map(r=>({ id: r.id, name: r.name, batch: r.batch, migration_time: r.migration_time }))); 
    const missing = '20260511_create_payfast_ipn_logs_and_update_bookings.js';
    const found = rows.find(r=>r.name === missing);
    if (!found) { console.log('Missing migration entry not present in knex_migrations, nothing to do.'); return process.exit(0); }
    console.log('Found stale migration entry:', found.name, 'batch', found.batch);
    // prompt-like confirmation removed; auto-delete to repair directory
    await knex('knex_migrations').where({ name: missing }).del();
    console.log('Deleted stale migration entry from knex_migrations:', missing);
    process.exit(0);
  }catch(err){ console.error('Repair failed', err); process.exit(2); }
}

run();
