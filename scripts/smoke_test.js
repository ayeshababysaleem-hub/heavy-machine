const knex = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function run(){
  if (!knex) return console.error('Knex not configured');
  const email = `smoke+${Date.now()}@gmail.com`;
  const password = 'Passw0rd!';
  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  const user = { id, name: 'Smoke Test', email, password: hashed, role: 'Customer', verified: true, cnic: null, verificationToken: null };
  // insert user
  console.log('Creating test user', email);
  try{
    await knex('users').insert(user);
  }catch(e){ console.error('Insert user failed', e); process.exit(1) }

  // login
  try{
    const loginRes = await fetch('http://localhost:3000/api/login',{ method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ email, password }) });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) { console.error('Login failed', loginJson); throw new Error('login failed') }
    const token = loginJson.token;
    console.log('Logged in, token length', token ? token.length : 0);

    // list machines
    const machinesRes = await fetch('http://localhost:3000/api/machines');
    const machinesJson = await machinesRes.json();
    const machines = machinesJson && machinesJson.data ? machinesJson.data : [];
    console.log('Found machines:', machines.length);
    if (machines.length === 0) { console.error('No machines to test booking'); throw new Error('no machines') }
    // prefer an approved machine
    const approved = machines.find(m => (m.status || 'approved') === 'approved');
    if (!approved) { console.error('No approved machines available for booking'); throw new Error('no approved') }
    const machineId = approved.id;

    // create booking
    const bookingBody = { machineId, startDate: '2026-06-01', durationDays: 2, location: 'Test', name: 'Smoke Test', email, cnic: '1234567890123', address: 'Test Address', phone: '03001234567' };
    const bookingRes = await fetch('http://localhost:3000/api/bookings',{ method: 'POST', headers: { 'content-type':'application/json', 'authorization':'Bearer '+token }, body: JSON.stringify(bookingBody) });
    const bookingJson = await bookingRes.json();
    if (!bookingRes.ok) { console.error('Create booking failed', bookingJson); throw new Error('booking failed') }
    console.log('Booking created:', bookingJson.booking ? bookingJson.booking.id : bookingJson);

    console.log('Smoke test completed successfully');
    // gracefully destroy knex pool and HTTP agent (undici) before exit
    try{ await knex.destroy(); }catch(e){}
    try{
      const undici = require('undici');
      if (undici && undici.globalAgent && typeof undici.globalAgent.destroy === 'function') {
        undici.globalAgent.destroy();
      }
      if (undici && undici.globalAgent && typeof undici.globalAgent.close === 'function') {
        undici.globalAgent.close();
      }
    }catch(e){}
    // allow event loop to drain
    await new Promise(r => setTimeout(r, 200));
    process.exit(0);
  }catch(e){
    console.error('Smoke test failed', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(err){}
    try{
      const undici = require('undici');
      if (undici && undici.globalAgent && typeof undici.globalAgent.destroy === 'function') undici.globalAgent.destroy();
    }catch(e){}
    await new Promise(r => setTimeout(r, 200));
    process.exit(1)
  }
}

run();
