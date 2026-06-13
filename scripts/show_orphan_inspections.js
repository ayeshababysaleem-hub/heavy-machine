const knex = require('../db');

async function main(){
  try{
    const has = await knex.schema.hasTable('inspections');
    if (!has){
      console.log('Inspections table does not exist; nothing to show.');
      await knex.destroy();
      return;
    }
    const rows = await knex('inspections as i')
      .leftJoin('bookings as b', 'i.bookingId', 'b.id')
      .whereNull('b.id')
      .select('i.*')
      .limit(100);
    if (!rows || rows.length === 0) {
      console.log('No orphan inspections found');
    } else {
      console.log('Orphan inspections:');
      for (const r of rows) console.log(r);
    }
    await knex.destroy();
  }catch(e){ console.error('Failed', e); try{ await knex.destroy(); }catch(_){}; process.exit(1);} 
}

main();
