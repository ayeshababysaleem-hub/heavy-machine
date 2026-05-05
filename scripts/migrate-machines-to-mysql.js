const fs = require('fs');
const path = require('path');
const knex = require('../db');

async function migrate(){
  if (!knex) return console.error('Knex not configured.');
  const file = path.join(__dirname, '..', 'machines.json');
  if (!fs.existsSync(file)) return console.error('machines.json not found');
  const raw = fs.readFileSync(file, 'utf8');
  let items = [];
  try{ items = JSON.parse(raw || '[]'); }catch(e){ console.error('Invalid machines.json', e); return }
  if (!Array.isArray(items)) return console.error('machines.json must be an array');

  console.log(`Found ${items.length} machines — importing...`);
  for (const m of items){
    const row = Object.assign({}, m);
    try{
      const exists = await knex('machines').where({ id: row.id }).first();
      if (exists){ console.log('Skipping existing machine:', row.id); continue }
      await knex('machines').insert(row);
      console.log('Inserted machine:', row.id);
    }catch(e){ console.error('Failed to import machine', row.id, e && e.message || e); }
  }
  console.log('Machines import complete');
  process.exit(0);
}

migrate().catch(e=>{ console.error('Migration failed', e); process.exit(1) });
