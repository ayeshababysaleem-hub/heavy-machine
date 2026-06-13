const fs = require('fs');
const path = require('path');
const knex = require('../db');

async function restore(file, { wipe=false } = {}){
  if (!file) throw new Error('Backup file required');
  let data = {};
  if (file && file.startsWith('db:')){
    // restore from DB backups table. Use 'db:latest' or 'db:<id>'
    const key = file.split(':',2)[1] || 'latest';
    let row;
    if (key === 'latest') row = await knex('backups').orderBy('createdAt', 'desc').first();
    else row = await knex('backups').where({ id: key }).first();
    if (!row) throw new Error('No backup found in DB for '+file);
    try{ data = JSON.parse(row.data || '{}'); }catch(e){ throw new Error('Invalid JSON in DB backup'); }
  } else {
    const p = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
    if (!fs.existsSync(p)) throw new Error('Backup file not found: '+p);
    const raw = JSON.parse(fs.readFileSync(p,'utf8'));
    data = raw && raw.data ? raw.data : {};
  }
  const order = ['users','machines','contacts','bookings','knex_migrations'];
  if (wipe){
    console.log('Wiping tables before restore');
    await knex.transaction(async trx => {
      for (const t of ['bookings','machines','contacts','users']){
        try{ await trx(t).del(); }catch(e){}
      }
    });
  }
  function toMySQLDate(input){
    if (!input) return null;
    const d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  for (const t of order){
    const rows = data[t] || [];
    console.log(`Restoring ${rows.length} rows into ${t}`);
    for (const r0 of rows){
      try{
        const r = Object.assign({}, r0);
        // normalize date/datetime fields
        if (r.createdAt) r.createdAt = toMySQLDate(r.createdAt);
        if (r.repliedAt) r.repliedAt = toMySQLDate(r.repliedAt);
        if (r.startDate) {
          const sd = new Date(r.startDate);
          if (!isNaN(sd.getTime())) r.startDate = sd.toISOString().slice(0,10);
        }
        if (r.endDate) {
          const ed = new Date(r.endDate);
          if (!isNaN(ed.getTime())) r.endDate = ed.toISOString().slice(0,10);
        }
        const exists = await knex(t).where({ id: r.id }).first(); if (exists) continue;
        await knex(t).insert(r);
      }catch(e){ console.error('Insert failed for table', t, e && e.message ? e.message : e) }
    }
  }
  console.log('Restore complete');
}

const argv = process.argv.slice(2);
if (argv.length === 0){ console.error('Usage: node scripts/restore-db.js <backup-file> [--wipe]'); process.exit(1) }
const file = argv[0];
const wipe = argv.includes('--wipe') || argv.includes('-w');
restore(file, { wipe }).then(()=>process.exit(0)).catch(e=>{ console.error('Restore failed', e); process.exit(1) });
