exports.up = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.string('payment_status').notNullable().defaultTo('unpaid');
    table.string('stripe_session_id').nullable();
    table.integer('amount_cents').notNullable().defaultTo(0);
    table.timestamp('paid_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('bookings', function(table) {
    table.dropColumn('payment_status');
    table.dropColumn('stripe_session_id');
    table.dropColumn('amount_cents');
    table.dropColumn('paid_at');
  });
};
