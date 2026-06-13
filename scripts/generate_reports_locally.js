const knex = require('../db');
const path = require('path');

function objectArrayToCSV(arr, cols){
  if (!Array.isArray(arr)) return '';
  const columns = Array.isArray(cols) && cols.length ? cols : Array.from(arr.reduce((s,o)=>{ Object.keys(o).forEach(k=>s.add(k)); return s; }, new Set()));
  const esc = v => '"'+String(v === null || typeof v === 'undefined' ? '' : v).replace(/"/g,'""')+'"';
  const header = columns.join(',');
  const rows = arr.map(r => columns.map(c => esc(r[c])).join(','));
  return header + '\n' + rows.join('\n');
}

async function run(){
  try{
    console.log('Generating local reports from DB...');
    // Users
    const users = await knex('users').select('*');
    const safeUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, verified: !!u.verified, accountTitle: u.accountTitle || null, jazzcashAccount: u.jazzcashAccount || null, easypaisaAccount: u.easypaisaAccount || null, createdAt: u.createdAt || null }));
    const usersCsv = objectArrayToCSV(safeUsers, ['id','name','email','role','verified','accountTitle','jazzcashAccount','easypaisaAccount','createdAt']);
    const usersFilename = `users-${new Date().toISOString().slice(0,10)}.csv`;
    console.log('Prepared users CSV rows=', safeUsers.length);
    try{
      const { v4 } = require('uuid');
      await knex('reports').insert({ id: v4(), type: 'users', filename: usersFilename, rows: safeUsers.length, content: usersCsv });
      console.log('Saved users report to DB');
    }catch(e){ console.warn('Failed to save users report to DB:', e && e.message ? e.message : e); }

    // Bookings
    const bookings = await knex('bookings').select('*');
    const machines = await knex('machines').select('*');
    const bookingsData = bookings.map(b => ({ id: b.id, machineId: b.machineId, machineName: (machines.find(m=>m.id===b.machineId)||{}).name || null, userId: b.userId, customerName: b.name || null, customerEmail: b.email || null, startDate: b.startDate || null, endDate: b.endDate || null, durationDays: b.durationDays || null, securityDeposit: b.securityDeposit || 0, customerAccount: b.customerAccount || null, status: b.status || null, payment_status: b.payment_status || null, createdAt: b.createdAt || null }));
    const bookingsCsv = objectArrayToCSV(bookingsData, ['id','machineId','machineName','userId','customerName','customerEmail','startDate','endDate','durationDays','securityDeposit','customerAccount','status','payment_status','createdAt']);
    const bookingsFilename = `bookings-${new Date().toISOString().slice(0,10)}.csv`;
    console.log('Prepared bookings CSV rows=', bookingsData.length);
    try{
      const { v4 } = require('uuid');
      await knex('reports').insert({ id: v4(), type: 'bookings', filename: bookingsFilename, rows: bookingsData.length, content: bookingsCsv });
      console.log('Saved bookings report to DB');
    }catch(e){ console.warn('Failed to save bookings report to DB:', e && e.message ? e.message : e); }

    // Payments (derived from bookings)
    const paymentsData = bookings.map(b => {
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
    const paymentsCsv = objectArrayToCSV(paymentsData, ['id','machineId','machineName','userId','customerName','customerEmail','startDate','endDate','durationDays','revenue','commission','net','securityDeposit','status','payment_status','payment_method','local_payment_id','sender_number','amount_cents']);
    const paymentsFilename = `payments-${new Date().toISOString().slice(0,10)}.csv`;
    console.log('Prepared payments CSV rows=', paymentsData.length);
    try{
      const { v4 } = require('uuid');
      await knex('reports').insert({ id: v4(), type: 'payments', filename: paymentsFilename, rows: paymentsData.length, content: paymentsCsv });
      console.log('Saved payments report to DB');
    }catch(e){ console.warn('Failed to save payments report to DB:', e && e.message ? e.message : e); }

    await knex.destroy();
    console.log('Report generation complete.');
  }catch(e){
    console.error('Failed to generate reports:', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(_){}
    process.exit(1);
  }
}

run();
