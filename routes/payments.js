const express = require('express');
const router = express.Router();
console.log('Payments routes module loaded');

const knex = require('../db');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// helper: upsert a payment record for a booking/local payment id
async function upsertPayment({ bookingId, localPaymentId, bookingRow, payload }){
  try{
    const existing = await knex('payments').where(function(){
      this.where({ bookingId });
      if (localPaymentId) this.orWhere({ local_payment_id: localPaymentId });
    }).first();
    const amount = payload && (payload.amount_cents || payload.amount) ? (payload.amount_cents || Math.round((payload.amount||0)*100)) : (bookingRow ? (bookingRow.amount_cents || 0) : 0);
    const insertObj = {
      id: uuidv4(),
      bookingId: bookingId,
      machineId: bookingRow ? bookingRow.machineId : null,
      userId: bookingRow ? bookingRow.userId : null,
      amount_cents: amount || 0,
      currency: (payload && payload.currency) || 'PKR',
      method: (payload && payload.method) || (bookingRow && bookingRow.payment_method) || null,
      local_payment_id: localPaymentId || (payload && payload.local_payment_id) || null,
      transaction_id: (payload && payload.transaction_id) || (payload && payload.transactionId) || null,
      sender_number: (payload && payload.sender_number) || (payload && payload.senderNumber) || null,
      status: (payload && payload.status) || (bookingRow && bookingRow.payment_status) || 'pending',
      revenue_cents: payload && payload.revenue_cents || null,
      commission_cents: payload && payload.commission_cents || null,
      net_cents: payload && payload.net_cents || null,
      paid_at: payload && payload.paid_at ? payload.paid_at : null,
      createdAt: new Date()
    };
    if (existing){
      // update some fields
      await knex('payments').where({ id: existing.id }).update({ status: insertObj.status, amount_cents: insertObj.amount_cents, transaction_id: insertObj.transaction_id, local_payment_id: insertObj.local_payment_id, sender_number: insertObj.sender_number, paid_at: insertObj.paid_at });
      return existing;
    }else{
      await knex('payments').insert(insertObj);
      return insertObj;
    }
  }catch(e){ console.warn('upsertPayment failed', e && e.message ? e.message : e); }
}

// configure multer storage for screenshots (store in public/images)
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, imagesDir); },
  filename: function (req, file, cb) { cb(null, uuidv4() + path.extname(file.originalname)); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
// Stripe removed: using local provider integrations only
// const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
// const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'pkr').toLowerCase();
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

// Stripe endpoints removed — local provider simulation will be used instead

module.exports = router;

// --- Local provider simulation endpoints (JazzCash / EasyPaisa) ---
// Create a simulated local payment for a booking. This does not contact real providers;
// it records a local payment id and marks the booking pending. Use `/api/payments/local-complete`
// to finalize the payment (simulated webhook/callback).
router.post('/api/payments/local-create', async (req, res) => {
  const { bookingId, provider } = req.body || {};
  if (!bookingId || !provider) return res.status(400).json({ error: 'bookingId and provider required' });
  try {
    const booking = await knex('bookings').where({ id: bookingId }).first();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // compute amount from machine price if available
    const machine = await knex('machines').where({ id: booking.machineId }).first();
    const price = machine ? Number(machine.price) || 0 : 0;
    const days = Number(booking.durationDays) || 1;
    const amount = Math.max(0, price * days);
    const localId = require('uuid').v4();
    await knex('bookings').where({ id: bookingId }).update({ payment_status: 'pending', payment_method: provider, local_payment_id: localId, amount_cents: Math.round(amount * 100) });
    // create a payments record for tracking
    try{ await upsertPayment({ bookingId, localPaymentId: localId, bookingRow: booking, payload: { amount_cents: Math.round(amount * 100), method: provider, status: 'pending' } }); }catch(_){ }
    // return a simple instruction URL where client can present payment instructions
    return res.json({ ok: true, localPaymentId: localId, instructionsUrl: `${APP_URL}/payments/local-wait.html?paymentId=${localId}&provider=${encodeURIComponent(provider)}&booking=${bookingId}` });
  } catch (err) {
    console.error('local-create failed', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Failed to create local payment' });
  }
});

// Finalize a simulated local payment (used by client-side test or by a webhook simulation).
// Accept either JSON or multipart/form-data (with optional `screenshot` file and `transactionId`)
router.post('/api/payments/local-complete', upload.single('screenshot'), async (req, res) => {
  const body = req.body || {};
  const bookingId = body.bookingId;
  const localPaymentId = body.localPaymentId;
  const screenshot = req.file || null;
  if (!bookingId || !localPaymentId) return res.status(400).json({ error: 'bookingId and localPaymentId required' });
  try {
    const booking = await knex('bookings').where({ id: bookingId }).first();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // ensure ids match (basic safety)
    if (!booking.local_payment_id || String(booking.local_payment_id) !== String(localPaymentId)) return res.status(400).json({ error: 'Payment id mismatch' });
    // Save transaction details and screenshot path, mark as pending for manual owner review
    const update = {
      payment_status: 'pending_review',
      sender_number: body.senderNumber || null,
      screenshot: screenshot ? screenshot.filename : null,
      payment_method: booking.payment_method || null,
      owner_account_title: body.ownerAccountTitle || null,
      owner_account_number: body.ownerAccountNumber || null,
      owner_account_provider: body.ownerAccountProvider || null
    };
    await knex('bookings').where({ id: bookingId }).update(update);
    console.log('Local payment submitted for review', { bookingId, localPaymentId, screenshot: update.screenshot });

    // upsert payment record with pending_review status and screenshot info
    try{ await upsertPayment({ bookingId, localPaymentId, bookingRow: booking, payload: { status: 'pending_review', method: booking.payment_method || null, sender_number: update.sender_number || null } }); }catch(_){ }

    // Notify the machine owner (if any) that a payment proof was submitted for review
    (async () => {
      try {
        const bookingRow = await knex('bookings').where({ id: bookingId }).first();
        if (!bookingRow) return;
        const machine = await knex('machines').where({ id: bookingRow.machineId }).first();
        if (!machine || !machine.ownerId) return;
        const owner = await knex('users').where({ id: machine.ownerId }).first();
        if (!owner || !owner.email) return;

        // Prepare a lightweight transporter (use Ethereal test account when possible)
        let transporter;
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: { user: testAccount.user, pass: testAccount.pass }
          });
        } catch (e) {
          transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
        }

        const adminLink = `${APP_URL}/admin-payments.html`;
        const mail = {
          from: 'no-reply@example.com',
          to: owner.email,
          subject: `Payment proof submitted for booking ${bookingId}`,
          html: `<p>Dear ${owner.name || 'Owner'},</p>
            <p>A customer submitted payment proof for booking <strong>${bookingId}</strong> on your machine <strong>${machine.name || machine.id}</strong>.</p>
            <p>Please review the submission and mark it as approved or rejected in the admin panel: <a href="${adminLink}">Admin Payments</a></p>
            <p>Regards,<br/>System</p>`
        };
        const info = await transporter.sendMail(mail);
        const preview = typeof nodemailer.getTestMessageUrl === 'function' ? nodemailer.getTestMessageUrl(info) : null;
        console.log('Owner notified of payment proof', { to: owner.email, preview });
      } catch (notifyErr) { console.error('Failed to notify owner about payment proof', notifyErr); }
    })();

    return res.json({ ok: true, bookingId });
  } catch (err) {
    console.error('local-complete failed', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Failed to complete payment' });
  }
});

// Webhook endpoint for external/local providers to notify payment completion
router.post('/api/payments/webhook', async (req, res) => {
  const payload = req.body || {};
  // support either bookingId or localPaymentId
  const bookingId = payload.bookingId || payload.booking_id || null;
  const localPaymentId = payload.localPaymentId || payload.local_payment_id || payload.paymentId || null;
  const status = String((payload.status || payload.payment_status || 'pending')).toLowerCase();
  const transactionId = payload.transactionId || payload.txnId || payload.transaction_id || null;

  if (!bookingId && !localPaymentId) return res.status(400).json({ error: 'Missing identifiers' });

  try {
    // find booking by ids
    let booking = null;
    if (bookingId) booking = await knex('bookings').where({ id: bookingId }).first();
    if (!booking && localPaymentId) booking = await knex('bookings').where({ local_payment_id: localPaymentId }).first();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // idempotent: if already paid, return OK
    if (String(booking.payment_status) === 'paid') {
      return res.json({ ok: true, alreadyPaid: true });
    }

    if (status === 'paid' || status === 'completed' || status === 'success'){
      // mark booking paid
      const paidAt = new Date().toISOString();
      await knex('bookings').where({ id: booking.id }).update({ payment_status: 'paid', paid_at: paidAt, local_payment_id: localPaymentId || booking.local_payment_id || null, amount_cents: payload.amount_cents || booking.amount_cents || null, transaction_id: transactionId || booking.transaction_id || null });
      // record payment in payments table
      try{ await upsertPayment({ bookingId: booking.id, localPaymentId: localPaymentId, bookingRow: booking, payload: { status: 'paid', amount_cents: payload.amount_cents || booking.amount_cents || 0, transaction_id: transactionId || null, paid_at: paidAt } }); }catch(_){ }
      // notify owner asynchronously if machine owner exists
      (async () => {
        try{
          const machine = await knex('machines').where({ id: booking.machineId }).first();
          if (machine && machine.ownerId){
            const owner = await knex('users').where({ id: machine.ownerId }).first();
            if (owner && owner.email){
              let transporter;
              try{
                const testAccount = await require('nodemailer').createTestAccount();
                transporter = require('nodemailer').createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } });
              }catch(e){ transporter = require('nodemailer').createTransport({ streamTransport: true, newline: 'unix' }); }
              await transporter.sendMail({ from: 'no-reply@example.com', to: owner.email, subject: 'Payment received for booking ' + booking.id, text: `Payment marked as paid for booking ${booking.id}` });
            }
          }
        }catch(e){ console.error('Webhook owner notify failed', e); }
      })();

      return res.json({ ok: true });
    }

    // if status is pending_review, mark so for manual review
    if (status === 'pending_review' || status === 'pending'){
      await knex('bookings').where({ id: booking.id }).update({ payment_status: 'pending_review', local_payment_id: localPaymentId || booking.local_payment_id || null });
      try{ await upsertPayment({ bookingId: booking.id, localPaymentId: localPaymentId, bookingRow: booking, payload: { status: 'pending_review' } }); }catch(_){ }
      return res.json({ ok: true, marked: 'pending_review' });
    }

    // otherwise store status
    await knex('bookings').where({ id: booking.id }).update({ payment_status: status });
    res.json({ ok: true });
  }catch(err){
    console.error('Webhook processing failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Failed' });
  }
});

