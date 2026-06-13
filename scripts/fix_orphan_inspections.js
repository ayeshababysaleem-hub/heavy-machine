const knex = require('../db');
// no filesystem writes; persist via DB

async function main(){
  try{
    const has = await knex.schema.hasTable('inspections');
    if (!has){
      console.log('Inspections table does not exist; nothing to fix.');
      await knex.destroy();
      return;
    }
    const rows = await knex('inspections as i')
      .leftJoin('bookings as b', 'i.bookingId', 'b.id')
      .whereNull('b.id')
      .select('i.*');

    if (!rows || rows.length === 0){
      console.log('No orphan inspections found.');
      await knex.destroy();
      return;
    }

    // Persist orphan inspections to DB `backups` table
    try{
      const { v4 } = require('uuid');
      await knex('backups').insert({ id: v4(), createdAt: new Date(), data: JSON.stringify(rows) });
      console.log('Saved orphan inspections to DB backups table, rows=', rows.length);
    }catch(e){ console.warn('Failed to save orphan inspections to DB backups:', e && e.message ? e.message : e); }

    // delete them
    const ids = rows.map(r => r.id).filter(Boolean);
    if (ids.length > 0){
      await knex('inspections').whereIn('id', ids).del();
      console.log('Deleted', ids.length, 'orphan inspections from DB.');
    }

    await knex.destroy();
  }catch(e){
    console.error('Failed to fix orphan inspections:', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(_){}
    process.exit(1);
  }
}

main();
