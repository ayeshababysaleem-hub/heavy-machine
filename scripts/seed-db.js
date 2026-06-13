const fs = require('fs');
const path = require('path');
const knex = require('../db');

function toMySQLDate(input){
  if (!input) return null;
  const d = (input instanceof Date) ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function loadJson(name){
  const p = path.join(__dirname, '..', 'archive', name);
  if (!fs.existsSync(p)) return [];
  try{ return JSON.parse(fs.readFileSync(p,'utf8')||'[]') }catch(e){ console.error('Invalid JSON', p, e); return [] }
}

async function seed({ wipe=false } = {}){
  if (!knex) throw new Error('Knex not configured');
  const users = await loadJson('users.json');
  const machines = await loadJson('machines.json');
  const bookings = await loadJson('bookings.json');
  const contacts = await loadJson('contacts.json');

  if (wipe) {
    console.log('Wiping bookings, machines, contacts, users (in that order)');
    await knex.transaction(async trx => {
      await trx('bookings').del();
      await trx('machines').del();
      await trx('contacts').del();
      await trx('users').del();
    });
  }

  // insert users
  for (const u of users){
    try{
      const exists = await knex('users').where({ id: u.id }).first();
      if (exists) continue;
      const row = Object.assign({}, u);
      if (row.createdAt) row.createdAt = toMySQLDate(row.createdAt);
      await knex('users').insert(row);
      console.log('Inserted user', row.email || row.id);
    }catch(e){ console.error('User insert failed', e && e.message ? e.message : e) }
  }

  // insert machines
  for (const m of machines){
    try{
      const exists = await knex('machines').where({ id: m.id }).first();
      if (exists) continue;
      const row = Object.assign({}, m);
      await knex('machines').insert(row);
      console.log('Inserted machine', row.id);
    }catch(e){ console.error('Machine insert failed', e && e.message ? e.message : e) }
  }

  // insert contacts
  for (const c of contacts){
    try{
      const exists = await knex('contacts').where({ id: c.id }).first();
      if (exists) continue;
      const row = Object.assign({}, c);
      if (row.createdAt) row.createdAt = toMySQLDate(row.createdAt);
      await knex('contacts').insert(row);
      console.log('Inserted contact', row.id);
    }catch(e){ console.error('Contact insert failed', e && e.message ? e.message : e) }
  }

  // insert bookings and update machine status/currentBookingId
  for (const b of bookings){
    try{
      const exists = await knex('bookings').where({ id: b.id }).first();
      if (exists) continue;
      const row = Object.assign({}, b);
      if (row.createdAt) row.createdAt = toMySQLDate(row.createdAt);
      await knex('bookings').insert(row);
      console.log('Inserted booking', row.id);
      // set machine to booked
      try{ await knex('machines').where({ id: row.machineId }).update({ status: 'booked', currentBookingId: row.id }) }catch(e){}
    }catch(e){ console.error('Booking insert failed', e && e.message ? e.message : e) }
  }

  console.log('Seeding complete');
  process.exit(0);
}

// parse args
const argv = process.argv.slice(2);
const wipe = argv.includes('--wipe') || argv.includes('-w');
seed({ wipe }).catch(e=>{ console.error('Seed failed', e); process.exit(1) });
