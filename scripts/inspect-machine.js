const knex = require('../db');
const nameOrId = process.argv[2];
(async ()=>{
  try{
    if (!nameOrId) return console.error('Usage: node inspect-machine.js <machine-name-or-id>'), process.exit(1);
    // try by id first
    let machine = await knex('machines').where({ id: nameOrId }).first();
    if (!machine) machine = await knex('machines').where('name', 'like', `%${nameOrId}%`).first();
    if (!machine) return console.error('Machine not found for', nameOrId), process.exit(2);
    console.log('Machine:', machine.id, machine.name, 'status=', machine.status, 'currentBookingId=', machine.currentBookingId, 'price=', machine.price);
    const bookings = await knex('bookings').where({ machineId: machine.id }).select('*');
    console.log('Bookings found for this machine:', bookings.length);
    for (const b of bookings) {
      console.log(' -', b.id, b.startDate, '→', b.endDate, 'status=', b.status, 'userId=', b.userId);
    }
    process.exit(0);
  }catch(e){ console.error('Inspect failed', e && e.message ? e.message : e); process.exit(1) }
})();
