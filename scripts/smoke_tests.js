const fetch = require('node-fetch');

async function main(){
  const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  console.log('Running smoke tests against', base);
  try{
    const r1 = await fetch(base + '/api/admin/stats');
    console.log('/api/admin/stats ->', r1.status);
    const r2 = await fetch(base + '/api/machines');
    console.log('/api/machines ->', r2.status);
    console.log('Smoke tests complete');
    process.exit(0);
  }catch(e){ console.error('Smoke tests failed', e); process.exit(1); }
}

main();
