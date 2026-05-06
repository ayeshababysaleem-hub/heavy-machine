const knex = require('../db');
(async ()=>{
  try{
    const rows = await knex('users').select('id','email','role');
    console.log('Users:', rows.length);
    for(const r of rows){
      console.log(r.id, r.email, 'role=', r.role);
    }
    process.exit(0);
  }catch(e){
    console.error('Failed to read users', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
