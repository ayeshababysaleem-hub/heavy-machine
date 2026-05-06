const fs = require('fs');
const path = require('path');
const knex = require('../db');

async function backup(){
  if (!knex) throw new Error('Knex not configured');
  const outDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g,'').slice(0,15);
  const outFile = path.join(outDir, `backup-json-${ts}.json`);
  const tables = ['users','machines','contacts','bookings','knex_migrations'];
  const data = {};
  for (const t of tables){
    try{ data[t] = await knex.select('*').from(t); }catch(e){ data[t] = []; }
  }
  fs.writeFileSync(outFile, JSON.stringify({ createdAt: new Date().toISOString(), data }, null, 2), 'utf8');
  console.log('Backup written to', outFile);
}

backup().then(()=>process.exit(0)).catch(e=>{ console.error('Backup failed', e); process.exit(1) });
