const express = require('express');
const app = express();
const knex = require("./db");
const path = require('path');
const fs = require('fs');


// Firebase code removed per request — server runs without firebase-admin

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
// Stripe (optional)
let stripe = null;
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const STRIPE_PUBLISHABLE = process.env.STRIPE_PUBLISHABLE || '';
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'pkr').toLowerCase();
if (STRIPE_SECRET) {
  try {
    stripe = require('stripe')(STRIPE_SECRET);
    console.log('Stripe initialized');
  } catch (e) {
    console.warn('Failed to initialize Stripe:', e && e.message ? e.message : e);
    stripe = null;
  }
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
// Only this email is allowed to act as Admin
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'ayeshasaleemvhr13@gmail.com';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB-backed helpers (MySQL only)
function toMySQLDate(input){
  if (!input) return null;
  const d = (input instanceof Date) ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getUsers(){ if (!knex) throw new Error('Database not configured'); return await knex('users').select('*'); }
async function getUserByEmail(email){ if (!knex) throw new Error('Database not configured'); return await knex('users').where({ email }).first(); }
async function getUserById(id){ if (!knex) throw new Error('Database not configured'); return await knex('users').where({ id }).first(); }
async function createUser(row){ if (!knex) throw new Error('Database not configured'); row.createdAt = toMySQLDate(row.createdAt || new Date()); return await knex('users').insert(row); }
async function updateUser(id, changes){ if (!knex) throw new Error('Database not configured'); return await knex('users').where({ id }).update(changes); }
async function deleteUser(id){ if (!knex) throw new Error('Database not configured'); return await knex('users').where({ id }).del(); }

async function getMachines(){ if (!knex) throw new Error('Database not configured'); return await knex('machines').select('*'); }
async function getMachineById(id){ if (!knex) throw new Error('Database not configured'); return await knex('machines').where({ id }).first(); }
async function createMachine(row){ if (!knex) throw new Error('Database not configured'); return await knex('machines').insert(row); }
async function updateMachine(id, changes){ if (!knex) throw new Error('Database not configured'); return await knex('machines').where({ id }).update(changes); }
async function deleteMachine(id){ if (!knex) throw new Error('Database not configured'); return await knex('machines').where({ id }).del(); }

async function getBookings(){ if (!knex) throw new Error('Database not configured'); return await knex('bookings').select('*'); }
async function getBookingById(id){ if (!knex) throw new Error('Database not configured'); return await knex('bookings').where({ id }).first(); }
async function createBooking(row){ if (!knex) throw new Error('Database not configured'); row.createdAt = toMySQLDate(row.createdAt || new Date()); return await knex('bookings').insert(row); }
async function updateBooking(id, changes){ if (!knex) throw new Error('Database not configured'); return await knex('bookings').where({ id }).update(changes); }
async function deleteBooking(id){ if (!knex) throw new Error('Database not configured'); return await knex('bookings').where({ id }).del(); }

async function getContacts(){ if (!knex) throw new Error('Database not configured'); return await knex('contacts').select('*'); }
async function createContact(row){ if (!knex) throw new Error('Database not configured'); row.createdAt = toMySQLDate(row.createdAt || new Date()); return await knex('contacts').insert(row); }
async function deleteContact(id){ if (!knex) throw new Error('Database not configured'); return await knex('contacts').where({ id }).del(); }

// Setup multer for image uploads
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, imagesDir) },
  filename: function (req, file, cb) { cb(null, uuidv4() + path.extname(file.originalname)) }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Machine file helpers removed — using MySQL via knex only

let transporter;
async function initMailer() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Nodemailer configured (ethereal).');
  } catch (err) {
    console.error('Failed to create test account, using console transport.', err);
    transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
  }
}

async function sendVerificationEmail(to, token) {
  const verifyUrl = `http://localhost:${PORT}/api/verify?token=${token}`;
  const info = await transporter.sendMail({
    from: 'no-reply@example.com',
    to,
    subject: 'Verify your email',
    html: `<p>Click to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
  const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
  return { info, preview, verifyUrl };
}

app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try{
    const user = await getUserByEmail(email);
    if (!user) return res.json({ exists: false });
    res.json({ exists: true, verified: !!user.verified });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  // validate name: must be present and include letters (not only numbers)
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Invalid name' });
  if (/^\d+$/.test(String(name).trim()) || !/[A-Za-z]/.test(String(name))) return res.status(400).json({ error: 'Invalid name' });
  // For Customers and Owners ensure the email domain exists (MX or A record)
  // Admins may now register too. If the email matches PRIMARY_ADMIN_EMAIL
  // it will be auto-verified to allow bootstrap; otherwise an admin
  // account is created unverified and must be approved by an existing Admin.
  if (role === 'Customer' || role === 'Owner') {
    try {
      const parts = String(email || '').split('@');
      if (parts.length !== 2) return res.status(400).json({ error: 'Invalid email' });
      const domain = parts[1].toLowerCase();
      let hasValid = false;
      try {
        const mx = await dns.resolveMx(domain);
        if (mx && mx.length > 0) hasValid = true;
      } catch (e) {
        // ignore, try A record next
      }
      if (!hasValid) {
        try {
          const a = await dns.resolve(domain);
          if (a && a.length > 0) hasValid = true;
        } catch (e) {
          // no A records either
        }
      }
      if (!hasValid) return res.status(400).json({ error: 'Email domain appears invalid or non-existent' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid email' });
    }
  }
  try{
    const exists = await getUserByEmail(email);
    if (exists) return res.status(400).json({ error: 'User exists' });
  }catch(e){ return res.status(500).json({ error: 'Failed checking user' }) }
  const hashed = await bcrypt.hash(password, 10);
  // Determine verification state and token
  let verificationToken = null;
  let verified = false;
  if (role === 'Admin') {
    if (email === PRIMARY_ADMIN_EMAIL) {
      // bootstrap primary admin: auto-verify
      verified = true;
      verificationToken = null;
    } else {
      verified = false;
      verificationToken = uuidv4();
    }
  } else {
    // Customers and Owners use email verification flow
    verificationToken = uuidv4();
    verified = false;
  }
  const user = { id: uuidv4(), name: name || '', email, password: hashed, role, verified, verificationToken };
  try{ await createUser(user); }catch(e){ console.error('Failed create user', e); return res.status(500).json({ error: 'Failed to save user' }) }
  try {
    // Only send verification email if a token was created (i.e. not auto-verified)
    if (verificationToken) {
      const sent = await sendVerificationEmail(email, verificationToken);
      return res.json({ ok: true, preview: sent.preview, verifyUrl: sent.verifyUrl });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error sending verification email:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Failed to send verification', detail: err && err.message ? err.message : String(err) });
  }
});

app.get('/api/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  try{
    const users = await getUsers();
    const user = users.find(u => u.verificationToken === token);
    if (!user) return res.status(400).send('Invalid token');
    await updateUser(user.id, { verified: true, verificationToken: null });
    return res.redirect('/login.html?verified=1');
  }catch(e){ console.error('Verify failed', e); return res.status(500).send('Server error') }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try{
    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (!user.verified) return res.status(403).json({ error: 'Email not verified' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  // For Customers and Owners ensure the email domain exists (MX or A record)
  if (user.role === 'Customer' || user.role === 'Owner') {
    try {
      const parts = String(user.email || '').split('@');
      if (parts.length !== 2) return res.status(400).json({ error: 'Invalid email' });
      const domain = parts[1].toLowerCase();
      let hasValid = false;
      try {
        const mx = await dns.resolveMx(domain);
        if (mx && mx.length > 0) hasValid = true;
      } catch (e) {
        // ignore, try A record next
      }
      if (!hasValid) {
        try {
          const a = await dns.resolve(domain);
          if (a && a.length > 0) hasValid = true;
        } catch (e) {
          // no A records either
        }
      }
      if (!hasValid) return res.status(403).json({ error: 'Email domain appears invalid or non-existent' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid email' });
    }
  }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  }catch(e){ console.error('Login failed', e); res.status(500).json({ error: 'Server error' }) }
});

async function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = h.slice(7);

  // Firebase integration removed — use JWT tokens only

  // Fallback: verify our legacy JWT tokens
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // enforce that Customers and Owners must be verified by an Admin before using the API
    const full = await getUserById(payload.id);
    if (full && (full.role === 'Customer' || full.role === 'Owner') && !full.verified) {
      return res.status(403).json({ error: 'Account requires admin verification' });
    }
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function roleRequired(role) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Missing user' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    // Further restrict Admin role to the primary admin email only
    if (role === 'Admin') {
      try {
        const u = await getUserById(req.user.id);
        if (!u || u.role !== 'Admin' || !u.verified) return res.status(403).json({ error: 'Forbidden' });
      } catch (e) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    next();
  };
}

app.get('/api/me', authMiddleware, async (req, res) => {
  try{
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, verificationToken, ...safe } = user;
    res.json(safe);
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

app.get('/api/admin', authMiddleware, roleRequired('Admin'), (req, res) => {
  res.json({ secret: 'only admins see this' });
});

// Admin stats: counts for users by role, total machines, and bookings (if tracked)
app.get('/api/admin/stats', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const users = await getUsers();
    const machines = await getMachines();
    const bookings = await getBookings();
    const usersByRole = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc }, {});
    res.json({ usersByRole, totalUsers: users.length, totalMachines: machines.length, bookingsCount: bookings.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: list users (safe fields)
app.get('/api/admin/users', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const users = await getUsers();
    const safe = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, verified: !!u.verified }));
    res.json({ data: safe, total: safe.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: verify a user (mark verified=true)
app.post('/api/admin/users/:id/verify', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  try{
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'Customer') {
      const cnic = req.body && req.body.cnic;
      if (!cnic) return res.status(400).json({ error: 'CNIC required to verify customers' });
      await updateUser(id, { cnic: String(cnic), verified: true });
    } else {
      await updateUser(id, { verified: true });
    }
    const updated = await getUserById(id);
    const { password, verificationToken, ...safe } = updated;
    res.json({ ok: true, user: safe });
  }catch(e){ console.error('Verify user failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Admin: delete a user
app.delete('/api/admin/users/:id', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  try{
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, verificationToken, ...safe } = user;
    // delete bookings by this user
    const bookings = await getBookings();
    for (const b of bookings.filter(x=>x.userId===id)){
      await deleteBooking(b.id);
    }
    // if owner, delete their machines and bookings for those machines
    if (user.role === 'Owner'){
      const machines = await getMachines();
      const ownerMachines = machines.filter(m=>m.ownerId===id).map(m=>m.id);
      for (const mid of ownerMachines){
        // delete bookings for machine
        const bks = (await getBookings()).filter(b=>b.machineId===mid);
        for (const b of bks) await deleteBooking(b.id);
        await deleteMachine(mid);
      }
    }
    await deleteUser(id);
    res.json({ ok: true, user: safe });
  }catch(e){ console.error('Delete user failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Admin: list all machines (no pagination for simplicity)
app.get('/api/admin/machines', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const machines = await getMachines();
    const bookings = await getBookings();
    const users = await getUsers();
  // attach bookings info to each machine (with user info)
  const data = machines.map(m => {
    const mBookings = bookings.filter(b => b.machineId === m.id).map(b => {
      const u = users.find(x => x.id === b.userId);
      return { id: b.id, startDate: b.startDate, endDate: b.endDate, durationDays: b.durationDays, location: b.location, name: b.name, email: b.email, cnic: b.cnic, address: b.address, phone: b.phone, user: u ? { id: u.id, name: u.name, email: u.email } : { id: b.userId } };
    });
    // If there are active bookings for this machine, reflect booked status in the admin view
    const status = (mBookings && mBookings.length > 0) ? 'booked' : (m.status || 'approved');
    const currentBookingId = (mBookings && mBookings.length > 0) ? mBookings[0].id : m.currentBookingId;
    return Object.assign({}, m, { bookings: mBookings, status, currentBookingId });
  });
    res.json({ data, total: data.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: list all bookings
app.get('/api/admin/bookings', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const bookings = await getBookings();
    res.json({ data: bookings });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: list contact messages
app.get('/api/admin/contacts', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const contacts = await getContacts();
    res.json({ data: contacts, total: contacts.length });
  }catch(e){ console.error('Failed to read contacts', e); res.status(500).json({ error: 'Failed to read contacts' }) }
});

// Admin: delete a contact message
app.delete('/api/admin/contacts/:id', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  try{
    const contacts = await getContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const removed = contacts[idx];
    await deleteContact(id);
    res.json({ ok: true, contact: removed });
  }catch(e){ console.error('Failed to delete contact', e); res.status(500).json({ error: 'Failed to delete contact' }) }
});

// Admin: reply to a contact message (send email and mark replied)
app.post('/api/admin/contacts/:id/reply', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try{
    const contacts = await getContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const contact = contacts[idx];
    // send email using transporter (nodemailer)
    try{
      const info = await transporter.sendMail({
        from: 'no-reply@example.com',
        to: contact.email,
        subject: 'Reply to your message',
        text: String(message),
        html: `<p>${String(message).replace(/\n/g,'<br/>')}</p>`
      });
      // mark contact as replied
      contact.reply = String(message);
      contact.repliedAt = new Date().toISOString();
      await knex('contacts').where({ id }).update({ reply: contact.reply, repliedAt: contact.repliedAt });
      const preview = typeof nodemailer.getTestMessageUrl === 'function' ? nodemailer.getTestMessageUrl(info) : null;
      return res.json({ ok: true, preview });
    }catch(err){
      console.error('Failed to send reply email', err);
      return res.status(500).json({ error: 'Failed to send reply', detail: err && err.message ? err.message : String(err) });
    }
  }catch(e){
    console.error('Failed to reply', e);
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// Get bookings (optionally filter by machineId)
app.get('/api/bookings', async (req, res) => {
  const machineId = req.query.machineId || null;
  try{
    const list = await getBookings();
    const data = machineId ? list.filter(b => b.machineId === machineId) : list;
    res.json({ data, total: data.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: view all payments (derived from bookings)
app.get('/api/admin/payments', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const bookings = await getBookings();
    const machines = await getMachines();
  const data = bookings.map(b => {
    const m = machines.find(x => x.id === b.machineId) || {};
    const price = Number(m.price) || 0;
    const days = Number(b.durationDays) || 1;
    const revenue = price * days;
    const commission = Math.round(revenue * 0.1);
    const net = revenue - commission;
    return {
      id: b.id,
      machineId: b.machineId,
      machineName: m.name || 'Unknown',
      userId: b.userId,
      customerName: b.name,
      customerEmail: b.email,
      startDate: b.startDate,
      endDate: b.endDate,
      durationDays: days,
      revenue,
      commission,
      net,
      status: b.status || 'pending'
    };
  });
  res.json({ data, total: data.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Contact submissions
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !phone || !message) return res.status(400).json({ error: 'Missing fields' });
  // validate name server-side: only letters, spaces, apostrophes or hyphens, 2-50 chars
  const nameRe = /^[A-Za-z][A-Za-z\s'\-]{1,49}$/;
  if (!nameRe.test(String(name).trim())) return res.status(400).json({ error: 'Invalid name format' });
  // validate phone server-side: enforce Pakistan phone formats
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const validPak = (phoneDigits.length === 11 && phoneDigits.startsWith('03')) ||
                   (phoneDigits.length === 12 && phoneDigits.startsWith('92') && phoneDigits[2] === '3') ||
                   (phoneDigits.length === 10 && phoneDigits.startsWith('3'));
  if (!validPak) return res.status(400).json({ error: 'Invalid Pakistan phone format' });
  const entry = { id: uuidv4(), name, email, phone, message, createdAt: new Date().toISOString() };
  try{ await createContact(entry); }catch(e){ console.error('Failed to save contact', e); }
  // also log to console for dev visibility
  console.log('Contact received:', entry);
  res.json({ ok: true });
});

// Create booking: authenticated users
app.post('/api/bookings', authMiddleware, async (req, res) => {
  if (req.user.role !== 'Customer') return res.status(403).json({ error: 'Only customers may create bookings' });
  const { machineId, startDate, durationDays, location, name, email, cnic, address, phone, paymentIntentId } = req.body || {};
  if (!machineId || !startDate || !durationDays || !name || !email || !cnic || !address || !phone) {
    return res.status(400).json({ error: 'Missing fields: machineId, startDate, durationDays, name, email, cnic, address, phone required' });
  }
  const machine = await getMachineById(machineId);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  // Only allow booking if machine is approved
  const status = machine.status || 'approved';
  if (status !== 'approved') return res.status(400).json({ error: 'Machine not available for booking (not approved)' });
  // parse dates
  const s = new Date(startDate);
  if (Number.isNaN(s.getTime())) return res.status(400).json({ error: 'Invalid startDate' });
  // server-side: disallow past start dates (compare local date only)
  const today = new Date();
  today.setHours(0,0,0,0);
  const sDateOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  if (sDateOnly < today) return res.status(400).json({ error: 'startDate cannot be in the past' });
  const days = parseInt(durationDays, 10);
  if (Number.isNaN(days) || days <= 0) return res.status(400).json({ error: 'Invalid durationDays' });
  const e = new Date(s);
  e.setDate(e.getDate() + days - 1); // inclusive end date

  // check overlapping bookings for same machine
  const bookings = (await getBookings()).filter(b => b.machineId === machineId);
  for (const b of bookings){
    const bs = new Date(b.startDate);
    const be = new Date(b.endDate);
    if (!(e < bs || s > be)) return res.status(409).json({ error: 'Machine already booked for requested dates' });
  }

  // If a paymentIntentId is provided, verify it with Stripe (if configured)
  if (paymentIntentId) {
    if (!stripe) return res.status(500).json({ error: 'Payment provider not configured' });
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!intent || intent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' });
    } catch (err) {
      console.error('Failed to verify payment intent', err);
      return res.status(400).json({ error: 'Invalid payment intent' });
    }
  }

  const booking = { id: uuidv4(), machineId, userId: req.user.id, startDate: s.toISOString().slice(0,10), endDate: e.toISOString().slice(0,10), durationDays: days, location: location || '', name, email, cnic, address, phone, status: 'pending', createdAt: new Date().toISOString() };
  try{
    await createBooking(booking);
    // mark machine as booked and store current booking id
    await updateMachine(machineId, { status: 'booked', currentBookingId: booking.id });
  }catch(e){ console.error('Failed to save booking', e); return res.status(500).json({ error: 'Failed to save booking' }) }
  res.json({ ok: true, booking });
});

// Admin/Owner: cancel/delete a booking
app.delete('/api/bookings/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try{
    const booking = await getBookingById(id);
    if (!booking) return res.status(404).json({ error: 'Not found' });
    const machine = await getMachineById(booking.machineId);
    const allowed = req.user && (req.user.role === 'Admin' || req.user.id === booking.userId || (machine && req.user.id === machine.ownerId));
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    await deleteBooking(id);
    // update machine status
    const remaining = (await getBookings()).filter(b => b.machineId === booking.machineId);
    if (machine){
      if (remaining.length === 0) await updateMachine(machine.id, { status: 'approved', currentBookingId: null });
      else await updateMachine(machine.id, { status: 'booked', currentBookingId: remaining[0].id });
    }
    res.json({ ok: true });
  }catch(e){ console.error('Delete booking failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Owner/Admin: approve a booking
app.patch('/api/bookings/:id/approve', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try{
    const booking = await getBookingById(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const machine = await getMachineById(booking.machineId);
    const allowed = req.user && (req.user.role === 'Admin' || (machine && req.user.id === machine.ownerId));
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    if (booking.status === 'approved') return res.status(400).json({ error: 'Already approved' });
    await updateBooking(id, { status: 'approved' });
  // Send email notification to customer
    try {
      const mailOptions = {
        from: 'noreply@yourapp.com',
        to: booking.email,
        subject: 'Booking Approved - ' + (machine ? machine.name : ''),
        html: `
          <h2>Booking Approved!</h2>
          <p>Dear ${booking.name},</p>
          <p>Your booking for <strong>${machine ? machine.name : 'machine'}</strong> has been approved.</p>
        `
      };
      await transporter.sendMail(mailOptions);
      console.log('Approval email sent to', booking.email);
    } catch (err) { console.error('Failed to send approval email:', err); }
    const updated = await getBookingById(id);
    res.json({ ok: true, booking: updated });
  }catch(e){ console.error('Approve failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Sample machinery catalog
// Get public list of machines
// GET /api/machines?q=&type=&page=&limit=
app.get('/api/machines', async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const type = req.query.type || '';
  const model = (req.query.model || '').toLowerCase();
  const location = (req.query.location || '').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '12', 10)));
  let list = await getMachines();
  // filter by type/model/location if provided
  if (type) list = list.filter(m => (m.type||'') === type);
  if (model) list = list.filter(m => (m.model||'').toLowerCase().includes(model));
  if (location) list = list.filter(m => (m.location||'').toLowerCase().includes(location));
  if (q) list = list.filter(m => (m.name||'').toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q));

  // by default, only return approved listings to public users
  // but allow owners to see their own listings (including pending), and admins to see all
  let requestingUser = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try { requestingUser = jwt.verify(auth.slice(7), JWT_SECRET); } catch (e) { requestingUser = null; }
  }
  list = list.filter(m => {
    const status = m.status || 'approved';
    // expose approved and currently booked machines to public so users can see availability
    if (status === 'approved' || status === 'booked') return true;
    // pending/rejected: allow if owner or admin
    if (requestingUser && (requestingUser.role === 'Admin' || requestingUser.id === m.ownerId)) return true;
    return false;
  });
  const total = list.length;
  const start = (page - 1) * limit;
  const data = list.slice(start, start + limit);
  res.json({ data, total, page, limit });
});

// Get single machine by id
app.get('/api/machines/:id', async (req, res) => {
  const { id } = req.params;
  try{
    const m = await getMachineById(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(m);
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Stripe config (publishable key) for client
app.get('/api/stripe-config', (req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE || null, currency: STRIPE_CURRENCY || 'pkr', enabled: !!stripe });
});

// Create a PaymentIntent for a pending booking
app.post('/api/create-payment-intent', authMiddleware, async (req, res) => {
  if (req.user.role !== 'Customer') return res.status(403).json({ error: 'Only customers may create payments' });
  if (!stripe) return res.status(500).json({ error: 'Payment provider not configured' });
  const { machineId, startDate, durationDays, name, email } = req.body || {};
  if (!machineId || !startDate || !durationDays || !name || !email) return res.status(400).json({ error: 'Missing booking fields' });
  const m = await getMachineById(machineId);
  if (!m) return res.status(404).json({ error: 'Machine not found' });
  const price = Number(m.price) || 0;
  const days = parseInt(durationDays, 10) || 1;
  // amount in smallest currency unit (assume 2 decimals)
  const amount = Math.max(0, Math.round(price * days * 100));
  try{
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: STRIPE_CURRENCY || 'pkr',
      metadata: { machineId, userId: req.user.id, startDate: String(startDate), durationDays: String(days), name: String(name) },
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  }catch(err){
    console.error('Failed to create payment intent', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Create a machine (owner only) - multipart/form-data (image optional)
app.post('/api/machines', authMiddleware, roleRequired('Owner'), upload.single('image'), async (req, res) => {
  const name = req.body.name;
  const type = req.body.type;
  const priceRaw = req.body.price;
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const model = req.body.model || '';
  const location = req.body.location || '';
  const description = req.body.description || '';
  if (!name || !type) return res.status(400).json({ error: 'Missing name or type' });
  const imageUrl = req.file ? `/images/${req.file.filename}` : (req.body.image || `https://via.placeholder.com/480x320?text=${encodeURIComponent(name)}`);
  const m = { id: uuidv4(), name, type, model, location, image: imageUrl, description, ownerId: req.user.id, status: 'pending', price };
  try{ await createMachine(m); res.json(m); }catch(e){ console.error('Create machine failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Update a machine (owner only) - supports multipart
app.put('/api/machines/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  try{
    const m = await getMachineById(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'Admin') return res.status(403).json({ error: 'Admins may not modify machines directly' });
    if (req.user.id !== m.ownerId) return res.status(403).json({ error: 'Forbidden' });
  // validation
    const name = req.body.name ?? m.name;
    const type = req.body.type ?? m.type;
    const priceRaw = req.body.price;
    const price = (typeof priceRaw !== 'undefined' && priceRaw !== null && priceRaw !== '') ? parseFloat(priceRaw) : undefined;
    const model = req.body.model ?? m.model;
    const location = req.body.location ?? m.location;
    if (!name || !type) return res.status(400).json({ error: 'Missing name or type' });
    const changes = { name, type, model, location, description: req.body.description ?? m.description };
    if (typeof price !== 'undefined' && !Number.isNaN(price)) changes.price = price;
    if (req.file) changes.image = `/images/${req.file.filename}`;
    try{ await updateMachine(id, changes); const updated = await getMachineById(id); res.json(updated); }catch(e){ console.error('Update machine failed', e); res.status(500).json({ error: 'Failed' }) }
  }catch(e){ console.error('Update machine failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Admin verifies (approves/rejects) a listing
app.post('/api/machines/:id/verify', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // expected 'approve' or 'reject'
  try{
    const m = await getMachineById(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (action === 'approve') await updateMachine(id, { status: 'approved' });
    else if (action === 'reject') await updateMachine(id, { status: 'rejected' });
    else return res.status(400).json({ error: 'Invalid action' });
    const updated = await getMachineById(id);
    res.json({ ok: true, status: updated.status });
  }catch(e){ console.error('Verify machine failed', e); res.status(500).json({ error: 'Failed' }) }
});

// Delete a machine (owner only)
app.delete('/api/machines/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try{
    const m = await getMachineById(id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'Admin') return res.status(403).json({ error: 'Admins may not delete machines' });
    if (req.user.id !== m.ownerId) return res.status(403).json({ error: 'Forbidden' });
    // remove image file if uploaded in public/images
    if (m.image && m.image.startsWith('/images/')){
      const imgPath = path.join(__dirname, 'public', m.image.replace('/images/',''));
      try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath) } catch(e){}
    }
    // remove any bookings for this machine
    try{
      const bookings = (await getBookings()).filter(b => b.machineId === id);
      for (const b of bookings) await deleteBooking(b.id);
    }catch(e){ console.error('Failed to remove bookings for deleted machine', e) }
    await deleteMachine(id);
    res.json({ ok: true });
  }catch(e){ console.error('Delete machine failed', e); res.status(500).json({ error: 'Failed' }) }
});

app.listen(PORT, async () => {
  await initMailer();
  console.log(`Server running on http://localhost:${PORT}`);
});
