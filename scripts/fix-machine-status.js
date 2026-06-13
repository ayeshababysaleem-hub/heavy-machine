const knex = require('../db');
const nameOrId = process.argv[2];
(async ()=>{
  try{
    if (!nameOrId) return console.error('Usage: node fix-machine-status.js <machine-name-or-id>'), process.exit(1);
    let machine = await knex('machines').where({ id: nameOrId }).first();
    if (!machine) machine = await knex('machines').where('name', 'like', `%${nameOrId}%`).first();
    if (!machine) return console.error('Machine not found for', nameOrId), process.exit(2);
    console.log('Found machine:', machine.id, machine.name, 'status=', machine.status, 'currentBookingId=', machine.currentBookingId);
    // clear stale booking markers
    await knex('machines').where({ id: machine.id }).update({ status: 'approved', currentBookingId: null });
    const updated = await knex('machines').where({ id: machine.id }).first();
    console.log('Updated machine:', updated.id, updated.name, 'status=', updated.status, 'currentBookingId=', updated.currentBookingId);
    process.exit(0);
  }catch(e){ console.error('Failed to fix machine', e && e.message ? e.message : e); process.exit(1) }
})();
