exports.up = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.string('payment_method').nullable();
    table.string('local_payment_id').nullable();
    table.string('transaction_id').nullable();
    table.string('sender_number').nullable();
    table.string('screenshot').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.dropColumn('payment_method');
    table.dropColumn('local_payment_id');
    table.dropColumn('transaction_id');
    table.dropColumn('sender_number');
    table.dropColumn('screenshot');
  });
};
