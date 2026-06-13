const knex = require('../db');
(async ()=>{
  try{
    const users = await knex('users').select('*');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  }catch(e){
    console.error('Error', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
