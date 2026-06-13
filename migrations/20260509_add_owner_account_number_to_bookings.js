exports.up = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.string('owner_account_number').nullable();
    table.string('owner_account_provider').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.dropColumn('owner_account_number');
    table.dropColumn('owner_account_provider');
  });
};
