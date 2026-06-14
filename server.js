// Provide a safe `localStorage` stub in Node to avoid experimental warning
if (typeof globalThis !== 'undefined' && Object.getOwnPropertyDescriptor(globalThis, 'localStorage') === undefined) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: false,
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      get length() { return 0; }
    }
  });
}

const express = require('express');
const bodyParser = require('body-parser');
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
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
// Stripe removed — using local provider integrations (JazzCash/EasyPaisa)

const PORT = process.env.PORT || 3000;
// Control DNS lookup behavior at login via environment variables:
// ENABLE_DNS_LOOKUP_ON_LOGIN: when 'true', perform a non-blocking DNS check after successful login
// LOG_DNS_LOOKUP_ON_LOGIN: when 'true', emit warnings to the server console when lookups fail
const ENABLE_DNS_LOOKUP_ON_LOGIN = String(process.env.ENABLE_DNS_LOOKUP_ON_LOGIN || '').toLowerCase() === 'true';
const LOG_DNS_LOOKUP_ON_LOGIN = String(process.env.LOG_DNS_LOOKUP_ON_LOGIN || '').toLowerCase() === 'true';
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
// Only this email is allowed to act as Admin
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'ayeshasaleemvhr13@gmail.com';

// Capture raw body for webhook signature verification while still parsing JSON
app.use(bodyParser.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

// Basic rate limiter for API endpoints
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 }); // 120 requests per minute
app.use('/api/', apiLimiter);

// Sentry init (optional) - require lazily to avoid pulling browser-only deps when not needed
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.requestHandler());
}

// Validation helper
function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: 'Invalid input', details: error.details.map(d=>d.message) });
    req.body = value;
    next();
  };
}

// mount payments routes (creates /api/create-checkout-session and /webhook)
try {
  const paymentsRouter = require('./routes/payments');
  app.use('/', paymentsRouter);
} catch (e) {
  console.warn('Payments routes not mounted:', e && e.message ? e.message : e);
}

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

async function getContactReplies(){ if (!knex) throw new Error('Database not configured'); return await knex('contact_replies').select('*'); }
async function createContactReply(row){ if (!knex) throw new Error('Database not configured'); row.createdAt = toMySQLDate(row.createdAt || new Date()); return await knex('contact_replies').insert(row); }

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
    // Prefer real SMTP when configured via environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || ''
        }
      });
      console.log('Nodemailer configured (SMTP).');
      return;
    }

    // If explicitly requested, use Ethereal test account (only when USE_ETHEREAL=1)
    if (String(process.env.USE_ETHEREAL || '').trim() === '1') {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.log('Nodemailer configured (ethereal).');
      return;
    }

    // Default: do not attempt to create test accounts — use a console/stream transport
    transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
    console.log('Nodemailer configured (console transport).');
  } catch (err) {
    console.error('Failed to initialize mailer — using console transport.', err && err.message ? err.message : err);
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
  // Validate basic input shape with Joi
  const schema = Joi.object({
    name: Joi.string().trim().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Customer','Owner','Admin').required()
  });
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: 'Invalid input', details: error.details.map(d=>d.message) });
  const { name, email, password, role } = value;
  // track whether email domain check failed (non-blocking)
  let emailDomainCheckFailed = false;
  // Additional name rules: must contain letters (not only numbers)
  if (/^\d+$/.test(String(name).trim()) || !/[A-Za-z]/.test(String(name))) return res.status(400).json({ error: 'Invalid name' });
  // For Customers and Owners ensure the email domain exists (MX or A record)
  // This check can be skipped by setting the environment variable `SKIP_EMAIL_DOMAIN_CHECK=1`.
  // Admins may now register too. If the email matches PRIMARY_ADMIN_EMAIL
  // it will be auto-verified to allow bootstrap; otherwise an admin
  // account is created unverified and must be approved by an existing Admin.
  if (role === 'Customer' || role === 'Owner') {
    if (String(process.env.SKIP_EMAIL_DOMAIN_CHECK || '').trim() === '1') {
      // skip domain DNS checks
    } else {
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
        if (!hasValid) {
          // don't block registration; flag the failure so UI can warn the user
          emailDomainCheckFailed = true;
          console.warn('Email domain DNS lookup failed for', domain);
        }
      } catch (e) {
        // non-fatal: flag and continue
        emailDomainCheckFailed = true;
        console.warn('Email domain validation error for', email, e && e.message ? e.message : e);
      }
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
      return res.json({ ok: true, preview: sent.preview, verifyUrl: sent.verifyUrl, emailDomainCheckFailed });
    }
    return res.json({ ok: true, emailDomainCheckFailed });
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
  // Domain validation is already performed at registration. Do not block login
  // if DNS lookups fail here — allow users who previously registered to sign in.
  // Optionally perform a non-blocking DNS check (controlled by env var) and log only when configured.
  if (ENABLE_DNS_LOOKUP_ON_LOGIN && (user.role === 'Customer' || user.role === 'Owner')) {
    (async () => {
      try {
        const parts = String(user.email || '').split('@');
        if (parts.length === 2) {
          const domain = parts[1].toLowerCase();
          try {
            const mx = await dns.resolveMx(domain);
            if (!(mx && mx.length > 0)) {
              const a = await dns.resolve(domain).catch(()=>[]);
              if (!(a && a.length > 0) && LOG_DNS_LOOKUP_ON_LOGIN) console.warn('Login: email domain lookup returned no MX/A records for', domain);
            }
          } catch (e) {
            if (LOG_DNS_LOOKUP_ON_LOGIN) console.warn('Login: DNS lookup failed for domain', domain, e && e.message ? e.message : e);
          }
        }
      } catch (e) {
        if (LOG_DNS_LOOKUP_ON_LOGIN) console.warn('Login: error while checking email domain', e && e.message ? e.message : e);
      }
    })();
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

// Customer: return reminders for current user's active rentals
app.get('/api/my/returns', authMiddleware, async (req, res) => {
  try{
    const userId = req.user.id;
    const all = await getBookings();
    const machines = await getMachines();
    // consider bookings that are approved (active) or paid
    const relevant = all.filter(b => String(b.userId) === String(userId) && ((b.status === 'approved') || (b.payment_status === 'paid')));
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const out = relevant.map(b => {
      const m = machines.find(x => x.id === b.machineId) || {};
      const end = b.endDate ? new Date(b.endDate) : null;
      let remainingDays = null;
      if (end && !isNaN(end.getTime())) {
        // remaining full days (end of day considered)
        const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        remainingDays = Math.ceil((endOnly - todayOnly) / msPerDay);
      }
      return {
        id: b.id,
        machineId: b.machineId,
        machineName: m.name || null,
        startDate: b.startDate,
        endDate: b.endDate,
        remainingDays,
        status: b.status || null,
        payment_status: b.payment_status || null
      };
    });
    res.json({ data: out, total: out.length });
  }catch(e){ console.error('Failed to load return reminders', e); res.status(500).json({ error: 'Failed' }) }
});

// Reminders: rentals due today or overdue for current user
app.get('/api/reminders/due-rentals', authMiddleware, async (req, res) => {
  try{
    const userId = req.user.id;
    const all = await getBookings();
    const machines = await getMachines();
    const users = await getUsers();
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const relevant = all.filter(b => String(b.userId) === String(userId) && ((b.status === 'approved') || (b.payment_status === 'paid')) );

    const dueToday = [];
    const overdue = [];

    for (const b of relevant){
      const m = machines.find(x => x.id === b.machineId) || {};
      const u = users.find(x => x.id === b.userId) || {};
      const end = b.endDate ? new Date(b.endDate) : null;
      if (!end || isNaN(end.getTime())) continue;
      const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const diffMs = endOnly - todayOnly;
      if (diffMs < 0) {
        overdue.push({ id: b.id, machineId: b.machineId, machineName: m.name || null, customerName: u.name || null, returnDate: b.endDate, status: 'overdue' });
      } else if (diffMs === 0) {
        dueToday.push({ id: b.id, machineId: b.machineId, machineName: m.name || null, customerName: u.name || null, returnDate: b.endDate, status: 'dueToday' });
      }
    }

    const totalCount = dueToday.length + overdue.length;
    res.json({ dueToday, overdue, totalCount });
  }catch(e){ console.error('Failed to load due rentals reminders', e); res.status(500).json({ error: 'Failed' }) }
});
 
// Update current user's account fields
app.put('/api/me', authMiddleware, async (req, res) => {
  try{
    const payload = req.body || {};
    console.log(`/api/me PUT for user=${req.user.id} payload=`, payload);
    const changes = {};
    const { accountTitle, jazzcashAccount, easypaisaAccount, name } = payload;
    if (typeof accountTitle !== 'undefined') changes.accountTitle = accountTitle || null;
    if (typeof jazzcashAccount !== 'undefined') changes.jazzcashAccount = jazzcashAccount || null;
    if (typeof easypaisaAccount !== 'undefined') changes.easypaisaAccount = easypaisaAccount || null;
    if (typeof name !== 'undefined') changes.name = name || null;
    if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await updateUser(req.user.id, changes);
    console.log(`/api/me updateUser result for user=${req.user.id}:`, result);
    const updated = await getUserById(req.user.id);
    const { password, verificationToken, ...safe } = updated;
    res.json(safe);
  }catch(e){ console.error('Update /api/me failed', e); res.status(500).json({ error: 'Failed to update' }) }
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

// Token refresh endpoint for JWT rotation
app.post('/api/token/refresh', authMiddleware, async (req, res) => {
  try{
    const payload = { id: req.user.id, role: req.user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: list users (safe fields)
app.get('/api/admin/users', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const users = await getUsers();
    const safe = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, verified: !!u.verified }));
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || '100', 10)));
    const start = (page - 1) * limit;
    const data = safe.slice(start, start + limit);
    res.json({ data, total: safe.length, page, limit });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: verify a user (mark verified=true)
app.post('/api/admin/users/:id/verify', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { id } = req.params;
  try{
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Allow admins to verify users without requiring CNIC.
    // If a CNIC is provided we'll save it, otherwise just mark verified.
    const cnic = req.body && req.body.cnic;
    const updates = { verified: true };
    if (cnic) updates.cnic = String(cnic);
    await updateUser(id, updates);
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
    const mAllBookings = bookings.filter(b => b.machineId === m.id);
    const mBookings = mAllBookings.map(b => {
      const u = users.find(x => x.id === b.userId);
      return { id: b.id, startDate: b.startDate, endDate: b.endDate, durationDays: b.durationDays, location: b.location, name: b.name, email: b.email, cnic: b.cnic, address: b.address, phone: b.phone, user: u ? { id: u.id, name: u.name, email: u.email } : { id: b.userId } };
    });
    // Preserve explicit machine.status (do not derive global 'booked' from individual bookings)
    const status = m.status || 'approved';
    const currentBookingId = m.currentBookingId || null;
    return Object.assign({}, m, { bookings: mBookings, status, currentBookingId });
  });
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || '100', 10)));
    const start = (page - 1) * limit;
    const pageData = data.slice(start, start + limit);
    res.json({ data: pageData, total: data.length, page, limit });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Public: platform admin account (safe fields) - returns the first Admin user's account details as a convenience
app.get('/api/admin/account', async (req, res) => {
  try{
    const users = await getUsers();
    const admin = users.find(u => u.role === 'Admin' && u.verified) || users.find(u => u.role === 'Admin');
    if (!admin) return res.status(404).json({ error: 'Not found' });
    const { password, verificationToken, ...safe } = admin;
    res.json({ accountTitle: safe.accountTitle || null, jazzcashAccount: safe.jazzcashAccount || null, easypaisaAccount: safe.easypaisaAccount || null, name: safe.name || null });
  }catch(e){ console.error('Failed to fetch admin account', e); res.status(500).json({ error: 'Failed' }) }
});

// Admin: list all bookings
app.get('/api/admin/bookings', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const bookings = await getBookings();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || '100', 10)));
    const start = (page - 1) * limit;
    const data = bookings.slice(start, start + limit);
    res.json({ data, total: bookings.length, page, limit });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: inspections endpoints
app.get('/api/admin/inspections', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const has = await knex.schema.hasTable('inspections');
    if (!has) return res.json({ data: [] });
    const inspections = await knex('inspections').select('*').orderBy('createdAt', 'desc');
    res.json({ data: inspections });
  }catch(e){ console.error('Failed to load inspections', e); res.status(500).json({ error: 'Failed' }) }
});

// Pending inspections: bookings that ended (endDate <= today) and are approved/paid and not inspected yet
app.get('/api/admin/inspections/pending', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const bookings = await getBookings();
    const has = await knex.schema.hasTable('inspections');
    const inspections = has ? await knex('inspections').select('bookingId') : [];
    const inspectedIds = new Set((inspections||[]).map(i=>i.bookingId));
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const pending = bookings.filter(b => {
      if (!b.endDate) return false;
      const end = new Date(b.endDate);
      const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (endOnly > todayOnly) return false; // not yet ended
      const isActive = (b.status === 'approved') || (b.payment_status === 'paid');
      if (!isActive) return false;
      if (inspectedIds.has(b.id)) return false;
      return true;
    });
    res.json({ data: pending, total: pending.length });
  }catch(e){ console.error('Failed to compute pending inspections', e); res.status(500).json({ error: 'Failed' }) }
});

// Create an inspection record for a booking
app.post('/api/admin/inspections/:bookingId', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { bookingId } = req.params;
  const { condition, notes, depositReturned } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
  try{
    const booking = await getBookingById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const inspectionsTableExists = await knex.schema.hasTable('inspections');
    if (!inspectionsTableExists) return res.status(410).json({ error: 'Inspections feature removed' });
    const id = uuidv4();
    await knex('inspections').insert({ id, bookingId, inspectedBy: req.user.id, notes: notes || null, condition: condition || 'good', depositReturned: (typeof depositReturned !== 'undefined') ? Number(depositReturned) : 0, createdAt: toMySQLDate(new Date()) });
    // update booking status to inspected
    await updateBooking(bookingId, { status: 'inspected' });
    res.json({ ok: true, id });
  }catch(e){
    console.error('Failed to save inspection', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed', detail: e && e.message ? e.message : String(e) });
  }
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
    // prevent duplicate replies
    const existing = await knex('contact_replies').where({ contactId: id }).first();
    if (existing) return res.status(400).json({ error: 'Already replied' });
    // persist reply in contact_replies
    try{
      await createContactReply({ id: uuidv4(), contactId: id, repliedBy: req.user.id, message: String(message), createdAt: new Date() });
    }catch(pe){ console.warn('Failed to persist contact reply', pe && pe.message ? pe.message : pe); }
    // Respond immediately so client isn't blocked by email delivery
    res.json({ ok: true });
    // send email asynchronously (fire-and-forget). Log errors but do not block response.
    (async () => {
      try{
        const info = await transporter.sendMail({
          from: 'no-reply@example.com',
          to: contact.email,
          subject: 'Reply to your message',
          text: String(message),
          html: `<p>${String(message).replace(/\n/g,'<br/>')}</p>`
        });
        const preview = typeof nodemailer.getTestMessageUrl === 'function' ? nodemailer.getTestMessageUrl(info) : null;
        console.log('Reply email sent (admin) for', id, 'preview:', preview);
      }catch(err){
        console.error('Background reply email send failed (admin)', err);
      }
    })();
    return;
  }catch(e){
    console.error('Failed to reply', e);
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// Owner: list contact messages (read-only view for owners)
app.get('/api/owner/contacts', authMiddleware, roleRequired('Owner'), async (req, res) => {
  try{
    const contacts = await getContacts();
    const replies = await getContactReplies().catch(()=>[]);
    const repliedIds = new Set((replies||[]).map(r=>r.contactId));
    // For owners include a `replied` flag so UI can disable replying if already replied
    const safe = (contacts || []).map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, message: c.message, createdAt: c.createdAt, replied: repliedIds.has(c.id) }));
    res.json({ data: safe, total: safe.length });
  }catch(e){ console.error('Failed to read owner contacts', e); res.status(500).json({ error: 'Failed to read contacts' }) }
});

// Owner: delete a contact message
app.delete('/api/owner/contacts/:id', authMiddleware, roleRequired('Owner'), async (req, res) => {
  const { id } = req.params;
  try{
    const contacts = await getContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const removed = contacts[idx];
    await deleteContact(id);
    res.json({ ok: true, contact: removed });
  }catch(e){ console.error('Failed to delete contact (owner)', e); res.status(500).json({ error: 'Failed to delete contact' }) }
});

// Owner: reply to a contact message (send email and mark replied)
app.post('/api/owner/contacts/:id/reply', authMiddleware, roleRequired('Owner'), async (req, res) => {
  const { id } = req.params;
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try{
    const contacts = await getContacts();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const contact = contacts[idx];
    try{
      // prevent duplicate replies
      const existing = await knex('contact_replies').where({ contactId: id }).first();
      if (existing) return res.status(400).json({ error: 'Already replied' });
      // persist reply
      try{ await createContactReply({ id: uuidv4(), contactId: id, repliedBy: req.user.id, message: String(message), createdAt: new Date() }); }catch(pe){ console.warn('Failed to persist contact reply', pe && pe.message ? pe.message : pe); }
      // respond immediately so client isn't blocked by email delivery
      res.json({ ok: true });
      // send email asynchronously (fire-and-forget). Log errors but do not block response.
      (async () => {
        try{
          const info = await transporter.sendMail({
            from: 'no-reply@example.com',
            to: contact.email,
            subject: 'Reply to your message',
            text: String(message),
            html: `<p>${String(message).replace(/\n/g,'<br/>')}</p>`
          });
          const preview = typeof nodemailer.getTestMessageUrl === 'function' ? nodemailer.getTestMessageUrl(info) : null;
          console.log('Reply email sent (owner) for', id, 'preview:', preview);
        }catch(err){
          console.error('Background reply email send failed (owner)', err);
        }
      })();
      return;
    }catch(err){
      console.error('Failed to reply contact (owner)', err);
      return res.status(500).json({ error: 'Failed to send reply', detail: err && err.message ? err.message : String(err) });
    }
  }catch(e){ console.error('Failed to reply contact (owner)', e); res.status(500).json({ error: 'Failed' }) }
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
      // expose security deposit if present on booking
      securityDeposit: Number(b.securityDeposit) || 0,
      status: b.status || 'pending',
      payment_status: b.payment_status || 'unpaid',
      payment_method: b.payment_method || null,
      local_payment_id: b.local_payment_id || null,
      sender_number: b.sender_number || null,
      screenshot: b.screenshot || null,
      amount_cents: b.amount_cents || 0
    };
  });
  res.json({ data, total: data.length });
  }catch(e){ res.status(500).json({ error: 'Failed' }) }
});

// Admin: CSV/JSON reports for Users, Bookings, Payments
function objectArrayToCSV(arr, cols){
  if (!Array.isArray(arr)) return '';
  const columns = Array.isArray(cols) && cols.length ? cols : Array.from(arr.reduce((s,o)=>{ Object.keys(o).forEach(k=>s.add(k)); return s; }, new Set()));
  const esc = v => '"'+String(v === null || typeof v === 'undefined' ? '' : v).replace(/"/g,'""')+'"';
  const header = columns.join(',');
  const rows = arr.map(r => columns.map(c => esc(r[c])).join(','));
  return header + '\n' + rows.join('\n');
}

app.get('/api/admin/reports/users', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const users = await getUsers();
    const safe = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, verified: !!u.verified, accountTitle: u.accountTitle || null, jazzcashAccount: u.jazzcashAccount || null, easypaisaAccount: u.easypaisaAccount || null, createdAt: u.createdAt || null }));
    const csv = objectArrayToCSV(safe, ['id','name','email','role','verified','accountTitle','jazzcashAccount','easypaisaAccount','createdAt']);
    const fname = `users-${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  }catch(e){ console.error('Failed to generate users report', e); res.status(500).json({ error: 'Failed' }) }
});

app.get('/api/admin/reports/bookings', authMiddleware, roleRequired('Admin'), async (req, res) => {
  try{
    const bookings = await getBookings();
    const machines = await getMachines();
    const users = await getUsers();
    const data = bookings.map(b => ({ id: b.id, machineId: b.machineId, machineName: (machines.find(m=>m.id===b.machineId)||{}).name || null, userId: b.userId, customerName: b.name || null, customerEmail: b.email || null, startDate: b.startDate || null, endDate: b.endDate || null, durationDays: b.durationDays || null, securityDeposit: b.securityDeposit || 0, customerAccount: b.customerAccount || null, status: b.status || null, payment_status: b.payment_status || null, createdAt: b.createdAt || null }));
    const csv = objectArrayToCSV(data, ['id','machineId','machineName','userId','customerName','customerEmail','startDate','endDate','durationDays','securityDeposit','customerAccount','status','payment_status','createdAt']);
    const fname = `bookings-${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  }catch(e){ console.error('Failed to generate bookings report', e); res.status(500).json({ error: 'Failed' }) }
});

app.get('/api/admin/reports/payments', authMiddleware, roleRequired('Admin'), async (req, res) => {
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
        securityDeposit: Number(b.securityDeposit) || 0,
        status: b.status || 'pending',
        payment_status: b.payment_status || 'unpaid',
        payment_method: b.payment_method || null,
        local_payment_id: b.local_payment_id || null,
        sender_number: b.sender_number || null,
        amount_cents: b.amount_cents || 0,
      };
    });
    const csv = objectArrayToCSV(data, ['id','machineId','machineName','userId','customerName','customerEmail','startDate','endDate','durationDays','revenue','commission','net','securityDeposit','status','payment_status','payment_method','local_payment_id','sender_number','amount_cents']);
    const fname = `payments-${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  }catch(e){ console.error('Failed to generate payments report', e); res.status(500).json({ error: 'Failed' }) }
});

// Admin: approve a pending booking/payment
app.post('/api/admin/payments/:bookingId/approve', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { bookingId } = req.params;
  try{
    const b = await getBookingById(bookingId);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    await updateBooking(bookingId, { status: 'approved', payment_status: 'paid', paid_at: toMySQLDate(new Date()) });
    // (no longer changing machine.status here; availability is per-date)
    const updatedBooking = await getBookingById(bookingId);
    const updatedMachine = b && b.machineId ? await getMachineById(b.machineId) : null;
    // ensure a payments record exists for this booking
    try{
      const existing = await knex('payments').where({ bookingId }).first();
      if (!existing){
        const amount = updatedBooking.amount_cents || (updatedMachine && Number(updatedMachine.price) ? Math.round(Number(updatedMachine.price) * (Number(updatedBooking.durationDays)||1) * 100) : 0);
        await knex('payments').insert({ id: uuidv4(), bookingId, machineId: updatedBooking.machineId || null, userId: updatedBooking.userId || null, amount_cents: amount, currency: 'PKR', method: updatedBooking.payment_method || null, status: 'paid', paid_at: new Date(), createdAt: new Date() });
      }
    }catch(pe){ console.warn('Failed to insert payment record on admin approve', pe && pe.message ? pe.message : pe); }
    return res.json({ ok: true, booking: updatedBooking, machine: updatedMachine });
  }catch(e){ console.error('approve failed', e); return res.status(500).json({ error: 'Failed' }) }
});

// Admin: reject a pending booking/payment
app.post('/api/admin/payments/:bookingId/reject', authMiddleware, roleRequired('Admin'), async (req, res) => {
  const { bookingId } = req.params;
  try{
    const b = await getBookingById(bookingId);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    await updateBooking(bookingId, { status: 'rejected', payment_status: 'rejected' });
    return res.json({ ok: true });
  }catch(e){ console.error('reject failed', e); return res.status(500).json({ error: 'Failed' }) }
});

// Contact submissions
app.post('/api/contact', async (req, res) => {
  // Validate contact payload
  const schema = Joi.object({
    name: Joi.string().pattern(/^[A-Za-z][A-Za-z\s'\-]{1,49}$/).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    message: Joi.string().min(5).max(2000).required()
  });
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: 'Invalid input', details: error.details.map(d=>d.message) });
  const { name, email, phone, message } = value;
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

// Create booking: only authenticated Customers may create bookings
app.post('/api/bookings', authMiddleware, roleRequired('Customer'), async (req, res) => {
  // authMiddleware has populated req.user (via JWT). Ensure role is Customer.
  const user = req.user;
  // validate booking payload
  const schema = Joi.object({
    machineId: Joi.string().required(),
    startDate: Joi.date().iso().required(),
    durationDays: Joi.number().integer().min(1).required(),
    location: Joi.string().allow('', null),
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    cnic: Joi.string().required(),
    address: Joi.string().required(),
    phone: Joi.string().required(),
    paymentIntentId: Joi.string().allow(null,'').optional(),
    securityDeposit: Joi.number().optional(),
    customerAccount: Joi.string().allow(null,'').optional()
  });
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ error: 'Invalid booking input', details: error.details.map(d=>d.message) });
  const { machineId, startDate, durationDays, location, name, email, cnic, address, phone, paymentIntentId, securityDeposit, customerAccount } = value;
  const machine = await getMachineById(machineId);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  // Force availability: allow bookings regardless of stored machine.status
  // (This makes machines always available for booking in server-side checks.)
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
  // consider any existing non-rejected bookings (pending or approved) when checking availability
  const bookings = (await getBookings()).filter(b => b.machineId === machineId && ((b.status || 'pending') !== 'rejected'));
  for (const b of bookings){
    const bs = new Date(b.startDate);
    const be = new Date(b.endDate);
    if (!(e < bs || s > be)) return res.status(409).json({ error: 'Machine already booked for requested dates' });
  }

  // Payment verification with external providers is handled via provider callbacks/webhooks

  const booking = { id: uuidv4(), machineId, userId: user ? user.id : null, startDate: s.toISOString().slice(0,10), endDate: e.toISOString().slice(0,10), durationDays: days, location: location || '', name, email, cnic, address, phone, securityDeposit: Number(securityDeposit) || 0, customerAccount: customerAccount || null, status: 'pending', createdAt: new Date().toISOString() };
  try{
    await createBooking(booking);
  }catch(e){ console.error('Failed to save booking', e); return res.status(500).json({ error: 'Failed to save booking', detail: e && e.message ? e.message : String(e) }) }
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
    // no global machine status change here; availability is determined by approved bookings per dates
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
    // (no longer changing machine.status here; availability is per-date based on approved bookings)
    const updatedBooking = await getBookingById(id);
    const updatedMachine = machine ? await getMachineById(machine.id) : null;
    // respond immediately
    res.json({ ok: true, booking: updatedBooking, machine: updatedMachine });
    // send approval email asynchronously (fire-and-forget)
    (async () => {
      try {
        if (transporter){
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
        }
      } catch (err) { console.error('Failed to send approval email:', err); }
    })();
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
  if (q) list = list.filter(m => {
    const name = (m.name||'').toLowerCase();
    const desc = (m.description||'').toLowerCase();
    const typ = (m.type||'').toLowerCase();
    const mdl = (m.model||'').toLowerCase();
    const loc = (m.location||'').toLowerCase();
    return name.includes(q) || desc.includes(q) || typ.includes(q) || mdl.includes(q) || loc.includes(q);
  });

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

// Public user info (safe fields) so clients can display owner payment details
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try{
    const u = await getUserById(id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const { password, verificationToken, cnic, ...safe } = u;
    // only expose non-sensitive fields
    const out = {
      id: safe.id,
      name: safe.name,
      email: safe.email,
      role: safe.role,
      accountTitle: safe.accountTitle || null,
      jazzcashAccount: safe.jazzcashAccount || null,
      easypaisaAccount: safe.easypaisaAccount || null,
    };
    res.json(out);
  }catch(e){ console.error('Failed to read user', e); res.status(500).json({ error: 'Failed' }) }
});

// Payment intents are provided by JazzCash/EasyPaisa endpoints in routes/payments.js

// Create a machine (owner only) - multipart/form-data (image optional)
app.post('/api/machines', authMiddleware, roleRequired('Owner'), upload.single('image'), async (req, res) => {
  // validate machine payload (multipart bodies are strings)
  const schema = Joi.object({
    name: Joi.string().min(1).required(),
    type: Joi.string().min(1).required(),
    price: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    model: Joi.string().allow('', null).optional(),
    location: Joi.string().allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    image: Joi.any()
  });
  const body = Object.assign({}, req.body);
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ error: 'Invalid input', details: error.details.map(d=>d.message) });
  const name = value.name;
  const type = value.type;
  const priceRaw = typeof value.price === 'string' ? value.price : value.price;
  const price = (typeof priceRaw !== 'undefined' && priceRaw !== null && priceRaw !== '') ? parseFloat(priceRaw) : null;
  const model = value.model || '';
  const location = value.location || '';
  const description = value.description || '';
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

async function startServer(startPort){
  let port = Number(startPort) || 3000;
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++){
    try{
      await new Promise((resolve, reject) => {
        const srv = app.listen(port, async () => {
          try{ await initMailer(); }catch(e){ console.error('Mailer init failed', e); }
          console.log(`Server running on http://localhost:${port}`);
          resolve();
        });
        srv.on('error', (err) => { reject(err); });
      });
      return; // started successfully
    }catch(err){
      if (err && err.code === 'EADDRINUSE'){
        console.warn(`Port ${port} in use, trying ${port+1}...`);
        port = port + 1;
        continue;
      }
      console.error('Failed to start server:', err && err.message ? err.message : err);
      process.exit(1);
    }
  }
  console.error('Unable to bind to any port after multiple attempts');
  process.exit(1);
}

// export app and helpers for testing
try{
  module.exports = { app, toMySQLDate, objectArrayToCSV };
}catch(e){ /* ignore when not present */ }

if (require.main === module) {
  startServer(PORT);
}
