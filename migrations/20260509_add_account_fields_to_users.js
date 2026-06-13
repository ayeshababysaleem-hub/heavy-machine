exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.string('accountTitle').nullable();
    table.string('paymentProvider').nullable();
    table.string('accountNumber').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('accountTitle');
    table.dropColumn('paymentProvider');
    table.dropColumn('accountNumber');
  });
};
