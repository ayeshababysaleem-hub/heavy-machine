const fs = require('fs');
const path = require('path');
const knex = require('../db');

async function migrate(){
  if (!knex) return console.error('Knex not configured. Set DB env vars and install dependencies.');
  const usersFile = path.join(__dirname, '..', 'users.json');
  if (!fs.existsSync(usersFile)) return console.error('users.json not found');
  const raw = fs.readFileSync(usersFile, 'utf8');
  let users = [];
  try{ users = JSON.parse(raw || '[]'); }catch(e){ console.error('Invalid users.json', e); return }
  if (!Array.isArray(users)) return console.error('users.json must be an array');

  function toMySQLDate(input){
    if (!input) return null;
    const d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  console.log(`Found ${users.length} users — importing...`);
  for (const u of users){
    const row = {
      id: u.id || require('uuid').v4(),
      name: u.name || '',
      email: u.email || '',
      password: u.password || '',
      role: u.role || 'Customer',
      verified: !!u.verified,
      cnic: u.cnic || null,
      verificationToken: u.verificationToken || null,
      createdAt: toMySQLDate(u.createdAt || new Date())
    };
    try{
      // insert or ignore duplicates
      const exists = await knex('users').where({ email: row.email }).first();
      if (exists){
        console.log('Skipping existing user:', row.email);
        continue;
      }
      await knex('users').insert(row);
      console.log('Inserted user:', row.email);
    }catch(e){
      console.error('Failed to import user', row.email, e && e.message ? e.message : e);
    }
  }
  console.log('Users import complete');
  process.exit(0);
}

migrate().catch(e=>{ console.error('Migration failed', e); process.exit(1) });
