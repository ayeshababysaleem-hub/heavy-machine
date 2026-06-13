const knex = require('../db');

async function backup(){
  if (!knex) throw new Error('Knex not configured');
  const ts = new Date().toISOString().replace(/[:.]/g,'').slice(0,15);
  const tables = ['users','machines','contacts','bookings','knex_migrations'];
  const data = {};
  for (const t of tables){
    try{ data[t] = await knex.select('*').from(t); }catch(e){ data[t] = []; }
  }
  // persist backup into DB table `backups`
  try{
    const { v4 } = require('uuid');
    await knex('backups').insert({ id: v4(), createdAt: new Date(), data: JSON.stringify(data) });
    console.log('Backup saved to DB table `backups` ts=', ts);
  }catch(e){ console.warn('Failed to save backup to DB:', e && e.message ? e.message : e); }
}

backup().then(()=>process.exit(0)).catch(e=>{ console.error('Backup failed', e); process.exit(1) });
