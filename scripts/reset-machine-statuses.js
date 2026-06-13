const knex = require('../db');

async function run(){
  if (!knex) { console.error('DB not configured'); process.exit(1); }
  try{
    const machines = await knex('machines').select('*');
    let changed = 0;
    for (const m of machines){
      if (m.status !== 'booked') continue;
      const approved = await knex('bookings').where({ machineId: m.id }).andWhere('status','approved').limit(1);
      if (!approved || approved.length === 0){
        await knex('machines').where({ id: m.id }).update({ status: 'approved', currentBookingId: null });
        console.log(`Updated machine ${m.id} (${m.name || 'unnamed'}) -> status=approved`);
        changed++;
      } else {
        console.log(`Skipping machine ${m.id} (${m.name || 'unnamed'}) - has approved bookings`);
      }
    }
    console.log(`Done. Machines updated: ${changed}`);
    process.exit(0);
  }catch(e){ console.error('Failed', e); process.exit(2); }
}

run();
