const knex = require('../db');

async function main(){
  try{
    console.log('Running DB integrity checks...');

    // 1) Bookings with missing machine
    const orphanBookings = await knex('bookings as b')
      .leftJoin('machines as m', 'b.machineId', 'm.id')
      .whereNull('m.id')
      .select('b.id','b.machineId','b.userId','b.startDate','b.endDate')
      .limit(20);
    console.log('\nOrphan bookings (machine missing):', orphanBookings.length);
    orphanBookings.forEach(r => console.log('-', r));

    // 2) Machines with invalid ownerId
    const badOwners = await knex('machines as m')
      .leftJoin('users as u', 'm.ownerId', 'u.id')
      .whereNotNull('m.ownerId')
      .whereNull('u.id')
      .select('m.id','m.name','m.ownerId')
      .limit(20);
    console.log('\nMachines with missing owner user:', badOwners.length);
    badOwners.forEach(r => console.log('-', r));

    // 3) Duplicate user emails
    const dupEmails = await knex('users').select('email').count('* as cnt').groupBy('email').having('cnt','>',1);
    console.log('\nDuplicate user emails:', dupEmails.length);
    dupEmails.forEach(r => console.log('-', r.email, 'count=', r.cnt));

    // 4) Bookings with missing dates
    const missingDates = await knex('bookings').whereNull('startDate').orWhereNull('endDate').select('id','startDate','endDate').limit(20);
    console.log('\nBookings with missing start/end dates:', missingDates.length);
    missingDates.forEach(r => console.log('-', r));

    // 5) Bookings where endDate < startDate
    const badDateRange = await knex('bookings').whereRaw('STR_TO_DATE(endDate, "%Y-%m-%d") < STR_TO_DATE(startDate, "%Y-%m-%d")').select('id','startDate','endDate').limit(20);
    console.log('\nBookings with endDate before startDate:', badDateRange.length);
    badDateRange.forEach(r => console.log('-', r));

    // 6) Bookings where durationDays doesn't match dates
    const mismatchedDuration = [];
    const bks = await knex('bookings').select('id','startDate','endDate','durationDays').limit(200);
    for (const b of bks){
      if (!b.startDate || !b.endDate) continue;
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
      const diffDays = Math.round(( (e - s) / (24*60*60*1000) )) + 1; // inclusive
      const dd = Number(b.durationDays) || 0;
      if (dd !== diffDays) mismatchedDuration.push({ id: b.id, startDate: b.startDate, endDate: b.endDate, durationDays: dd, expected: diffDays });
    }
    console.log('\nBookings with mismatched durationDays:', mismatchedDuration.length);
    mismatchedDuration.slice(0,20).forEach(r => console.log('-', r));

    // 7) Inspections referencing missing bookings
    const hasIns = await knex.schema.hasTable('inspections');
    if (hasIns){
      const badInspections = await knex('inspections as i')
        .leftJoin('bookings as b', 'i.bookingId', 'b.id')
        .whereNull('b.id')
        .select('i.id','i.bookingId')
        .limit(20);
      console.log('\nInspections with missing booking:', badInspections.length);
      badInspections.forEach(r => console.log('-', r));
    }else{
      console.log('\nInspections table missing; skipping inspections integrity check.');
    }

    // 8) Bookings with payment_status='paid' but amount_cents is zero or missing
    const suspiciousPayments = await knex('bookings').where('payment_status','paid').andWhere(function(){ this.whereNull('amount_cents').orWhere('amount_cents', 0)}).select('id','payment_status','amount_cents').limit(20);
    console.log('\nPaid bookings with zero/missing amount_cents:', suspiciousPayments.length);
    suspiciousPayments.forEach(r => console.log('-', r));

    await knex.destroy();
  }catch(e){
    console.error('Integrity check failed:', e && e.message ? e.message : e);
    try{ await knex.destroy(); }catch(_){}
    process.exit(1);
  }
}

main();
