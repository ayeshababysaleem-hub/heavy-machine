const knex = require('../db');
(async ()=>{
  try{
    const bookings = await knex('bookings').select('*');
    console.log(JSON.stringify(bookings, null, 2));
    process.exit(0);
  }catch(e){ console.error(e && e.stack ? e.stack : e); process.exit(1); }
})();
