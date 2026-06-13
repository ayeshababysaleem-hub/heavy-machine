const knex = require('../db');

async function main(){
  try{
    console.log('Finding bookings pending review...');
    const rows = await knex('bookings').where({ payment_status: 'pending_review' }).select('*');
    console.log('Pending-review bookings:', rows.length);
    for (const r of rows) console.log('-', r.id, r.local_payment_id || '(no local id)', r.customerAccount || r.name || r.email);
    await knex.destroy();
  }catch(e){ console.error('Failed', e); try{ await knex.destroy(); }catch(_){}; process.exit(1);} 
}

main();
