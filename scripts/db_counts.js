const knex = require('../db');

async function main(){
  try{
    console.log('Checking DB connectivity and counts...');
    const tables = ['users','machines','bookings','contacts','knex_migrations'];
    for (const t of tables){
      try{
        const row = await knex(t).count('* as cnt').first();
        console.log(t.padEnd(16), ':', row && (row.cnt !== undefined ? row.cnt : row['count(*)']) );
      }catch(e){
        console.log(t.padEnd(16), ':', 'error -', e && e.message ? e.message : e);
      }
    }

    // show recent migrations
    try{
      const migs = await knex('knex_migrations').select('*').orderBy('id','desc').limit(10);
      console.log('\nRecent migrations (latest first):');
      for (const m of migs) console.log('-', m.name || JSON.stringify(m));
    }catch(e){
      console.log('knex_migrations: error reading migrations table -', e && e.message ? e.message : e);
    }

    await knex.destroy();
  }catch(e){
    console.error('DB check failed:', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(_){}
    process.exit(1);
  }
}

main();
