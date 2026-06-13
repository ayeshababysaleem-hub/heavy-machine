const assert = require('assert');
const request = require('supertest');
const knex = require('../db');
const jwt = require('jsonwebtoken');
const { toMySQLDate, objectArrayToCSV, app } = require('../server');

(async function(){
  try{
    console.log('Quick tests start...');
    // helper tests
    const d = new Date('2026-05-12T10:11:12Z');
    const mysqlDate = toMySQLDate(d);
    assert(typeof mysqlDate === 'string' && mysqlDate.startsWith('2026-05-12'));
    console.log('toMySQLDate ok');

    const csv = objectArrayToCSV([{a:1,b:'x'},{a:2,b:'y'}], ['a','b']);
    assert(csv.includes('a,b'));
    console.log('objectArrayToCSV ok');

    // e2e: reports endpoint
    const admin = await knex('users').where({ role: 'Admin' }).first();
    if (!admin) throw new Error('No Admin user found in DB');
    const token = jwt.sign({ id: admin.id, role: 'Admin' }, process.env.JWT_SECRET || 'replace_this_secret', { expiresIn: '1h' });
    const res = await request(app).get('/api/admin/reports/users').set('Authorization', 'Bearer ' + token);
    assert(res.status === 200, 'Expected 200 from reports endpoint');
    const ct = (res.headers['content-type'] || '');
    assert(ct.includes('text/csv'));
    console.log('reports endpoint ok');

    await knex.destroy();
    console.log('All quick tests passed');
    process.exit(0);
  }catch(e){
    console.error('Quick tests failed:', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(_){ }
    process.exit(2);
  }
})();
