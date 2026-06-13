const fetch = (typeof global.fetch === 'function') ? global.fetch : require('node-fetch');
const jwt = require('jsonwebtoken');
const adminId = '5a55f167-49dc-434f-a7f3-1622da411423';
const bookingId = '2355581f-ec6d-46db-a9f6-998984c45fb6';
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
(async ()=>{
  try{
    const token = jwt.sign({ id: adminId, role: 'Admin' }, JWT_SECRET, { expiresIn: '2h' });
    const base = process.env.SERVER_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/admin/inspections/${bookingId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ condition: 'good', depositReturned: 0, notes: 'automated test' }) });
    const text = await res.text();
    console.log('status', res.status, 'body:', text);
    process.exit(0);
  }catch(e){ console.error(e && e.stack ? e.stack : e); process.exit(1); }
})();
