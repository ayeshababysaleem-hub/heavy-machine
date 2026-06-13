exports.up = function(knex) {
  return knex.schema.table('bookings', function(table) {
    table.string('customerAccount').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('bookings', function(table) {
    table.dropColumn('customerAccount');
  });
};
