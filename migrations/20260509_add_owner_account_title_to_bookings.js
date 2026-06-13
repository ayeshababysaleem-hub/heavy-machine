exports.up = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.string('owner_account_title').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.dropColumn('owner_account_title');
  });
};
