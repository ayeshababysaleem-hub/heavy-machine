const knex = require('../db');

async function indexExists(table, indexName) {
  const [rows] = await knex.raw(
    "SELECT COUNT(1) as cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [process.env.DB_NAME || 'heavy_machine', table, indexName]
  );
  return rows[0].cnt > 0 || rows[0].CNT > 0;
}

async function fkExists(table, constraintName) {
  const [rows] = await knex.raw(
    "SELECT COUNT(1) as cnt FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE='FOREIGN KEY'",
    [process.env.DB_NAME || 'heavy_machine', table, constraintName]
  );
  return rows[0].cnt > 0 || rows[0].CNT > 0;
}

async function run() {
  try {
    console.log('Starting orphan checks and fixes...');

    // 1) Orphan bookings: missing users
    const orphanUsers = await knex('bookings as b')
      .leftJoin('users as u', 'b.userId', 'u.id')
      .whereNull('u.id')
      .select('b.*');

    const orphanMachines = await knex('bookings as b')
      .leftJoin('machines as m', 'b.machineId', 'm.id')
      .whereNull('m.id')
      .select('b.*');

    console.log(`Orphan bookings (missing user): ${orphanUsers.length}`);
    console.log(`Orphan bookings (missing machine): ${orphanMachines.length}`);

    const totalOrphans = new Map();
    orphanUsers.forEach(r => totalOrphans.set(r.id, r));
    orphanMachines.forEach(r => totalOrphans.set(r.id, r));

    if (totalOrphans.size > 0) {
      // ensure orphaned_bookings exists
      const exists = await knex.schema.hasTable('orphaned_bookings');
      if (!exists) {
        await knex.schema.createTable('orphaned_bookings', table => {
          table.string('id').primary();
          table.json('data').notNullable();
          table.timestamp('migratedAt').defaultTo(knex.fn.now());
        });
        console.log('Created table orphaned_bookings');
      }

      const ids = Array.from(totalOrphans.keys());
      // copy rows into orphaned_bookings
      for (const id of ids) {
        const row = totalOrphans.get(id);
        await knex('orphaned_bookings').insert({ id: row.id, data: JSON.stringify(row) }).catch(e => console.error('insert orphan error', e));
      }

      // delete from bookings
      await knex('bookings').whereIn('id', ids).del();
      console.log(`Moved ${ids.length} orphan bookings into orphaned_bookings and deleted from bookings`);
    }

    // 2) Fix machines.ownerId pointing to missing users -> set to NULL
    const badOwners = await knex('machines as m')
      .leftJoin('users as u', 'm.ownerId', 'u.id')
      .whereNotNull('m.ownerId')
      .whereNull('u.id')
      .select('m.id', 'm.ownerId');

    console.log(`Machines with missing owners: ${badOwners.length}`);
    if (badOwners.length > 0) {
      const badIds = badOwners.map(r => r.id);
      await knex('machines').whereIn('id', badIds).update({ ownerId: null });
      console.log(`Cleared ownerId for ${badIds.length} machines`);
    }

    // 3) Add foreign keys (conservative): make bookings.userId and machineId nullable, then add FK with ON DELETE SET NULL
    // Alter columns to nullable using raw ALTER (safer for MySQL)
    try {
      await knex.raw("ALTER TABLE bookings MODIFY COLUMN userId VARCHAR(255) NULL");
      await knex.raw("ALTER TABLE bookings MODIFY COLUMN machineId VARCHAR(255) NULL");
      console.log('Made bookings.userId and bookings.machineId nullable');
    } catch (e) {
      console.warn('Could not alter column nullability (may vary by adapter):', e.message || e);
    }

    // add FK userId
    const fkUserName = 'fk_bookings_userId';
    if (!(await fkExists('bookings', fkUserName))) {
      try {
        await knex.raw(`ALTER TABLE bookings ADD CONSTRAINT ${fkUserName} FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE`);
        console.log('Added foreign key', fkUserName);
      } catch (e) {
        console.error('Error adding FK userId:', e.message || e);
      }
    } else {
      console.log('Foreign key', fkUserName, 'already exists');
    }

    // add FK machineId
    const fkMachineName = 'fk_bookings_machineId';
    if (!(await fkExists('bookings', fkMachineName))) {
      try {
        await knex.raw(`ALTER TABLE bookings ADD CONSTRAINT ${fkMachineName} FOREIGN KEY (machineId) REFERENCES machines(id) ON DELETE SET NULL ON UPDATE CASCADE`);
        console.log('Added foreign key', fkMachineName);
      } catch (e) {
        console.error('Error adding FK machineId:', e.message || e);
      }
    } else {
      console.log('Foreign key', fkMachineName, 'already exists');
    }

    // add FK for machines.ownerId -> users.id
    const fkOwnerName = 'fk_machines_ownerId';
    if (!(await fkExists('machines', fkOwnerName))) {
      try {
        await knex.raw(`ALTER TABLE machines ADD CONSTRAINT ${fkOwnerName} FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE`);
        console.log('Added foreign key', fkOwnerName);
      } catch (e) {
        console.error('Error adding FK machines.ownerId:', e.message || e);
      }
    } else {
      console.log('Foreign key', fkOwnerName, 'already exists');
    }

    // 4) Add indexes if missing
    const indexesToAdd = [
      { table: 'bookings', col: 'endDate', name: 'idx_bookings_endDate' },
      { table: 'bookings', col: 'userId', name: 'idx_bookings_userId' },
      { table: 'bookings', col: 'machineId', name: 'idx_bookings_machineId' },
      { table: 'bookings', col: 'status', name: 'idx_bookings_status' },
      { table: 'bookings', col: 'payment_status', name: 'idx_bookings_payment_status' }
    ];

    for (const idx of indexesToAdd) {
      const exists = await indexExists(idx.table, idx.name);
      if (!exists) {
        try {
          await knex.raw(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.col})`);
          console.log(`Created index ${idx.name} on ${idx.table}(${idx.col})`);
        } catch (e) {
          console.error(`Error creating index ${idx.name}:`, e.message || e);
        }
      } else {
        console.log(`Index ${idx.name} already exists`);
      }
    }

    // 5) Sample queries: due today and overdue
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = await knex('bookings').where('endDate', today).select('id', 'userId', 'machineId', 'endDate');
    const overdue = await knex('bookings').where('endDate', '<', today).select('id', 'userId', 'machineId', 'endDate');

    console.log(`Sample query results for ${today}: dueToday=${dueToday.length}, overdue=${overdue.length}`);
    if (dueToday.length) console.table(dueToday);
    if (overdue.length) console.table(overdue);

    console.log('Completed all steps.');
  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    process.exit(0);
  }
}

run();
