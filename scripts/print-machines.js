const knex = require('../db');

(async ()=>{
  try{
    const rows = await knex('machines').select('id','name','price');
    console.log('Machines:', rows.length);
    for(const r of rows){
      console.log(r.id, r.name, 'price=', r.price, 'type=', typeof r.price);
    }
    process.exit(0);
  }catch(e){
    console.error('Failed to read machines', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
