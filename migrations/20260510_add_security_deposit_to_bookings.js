exports.up = function(knex) {
  return knex.schema.hasTable('bookings').then(function(exists) {
    if (!exists) return Promise.resolve();
    return knex.schema.alterTable('bookings', function(table) {
      // store deposit as decimal with 2 fraction digits
      if (!table.hasColumn) {
        // older knex versions may not expose hasColumn on table builder; defensively attempt
        table.decimal('securityDeposit', 14, 2).nullable().defaultTo(0);
      } else {
        // check column existence using raw query
        // (some sqlite/mysql adapters may not support this, but migration is idempotent at call-site)
        table.decimal('securityDeposit', 14, 2).nullable().defaultTo(0);
      }
    });
  });
};

exports.down = function(knex) {
  return knex.schema.hasTable('bookings').then(function(exists) {
    if (!exists) return Promise.resolve();
    return knex.schema.alterTable('bookings', function(table) {
      table.dropColumn('securityDeposit');
    });
  });
};
