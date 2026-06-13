const fs = require('fs');
const path = require('path');
const knex = require('../db');

async function migrate(){
  if (!knex) return console.error('Knex not configured.');
  const file = path.join(__dirname, '..', 'archive', 'bookings.json');
  if (!fs.existsSync(file)) return console.error('archive/bookings.json not found');
  const raw = fs.readFileSync(file, 'utf8');
  let items = [];
  try{ items = JSON.parse(raw || '[]'); }catch(e){ console.error('Invalid bookings.json', e); return }
  if (!Array.isArray(items)) return console.error('bookings.json must be an array');

  function toMySQLDate(input){
    if (!input) return null;
    const d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  console.log(`Found ${items.length} bookings — importing...`);
  for (const b of items){
    const row = Object.assign({}, b);
    // normalize createdAt to DATETIME
    if (row.createdAt) row.createdAt = toMySQLDate(row.createdAt);
    // ensure date-only fields are left as-is (YYYY-MM-DD)
    try{
      const exists = await knex('bookings').where({ id: row.id }).first();
      if (exists){ console.log('Skipping existing booking:', row.id); continue }
      await knex('bookings').insert(row);
      console.log('Inserted booking:', row.id);
    }catch(e){ console.error('Failed to import booking', row.id, e && e.message || e); }
  }
  console.log('Bookings import complete');
  process.exit(0);
}

migrate().catch(e=>{ console.error('Migration failed', e); process.exit(1) });
