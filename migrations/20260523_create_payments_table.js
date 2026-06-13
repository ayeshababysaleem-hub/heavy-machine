exports.up = function(knex) {
  return knex.schema.createTable('payments', function(table) {
    table.string('id').primary();
    table.string('bookingId').notNullable();
    table.string('machineId').nullable();
    table.string('userId').nullable();
    table.integer('amount_cents').notNullable().defaultTo(0);
    table.string('currency').notNullable().defaultTo('USD');
    table.string('method').nullable();
    table.string('local_payment_id').nullable();
    table.string('transaction_id').nullable();
    table.string('sender_number').nullable();
    table.string('status').notNullable().defaultTo('pending');
    table.integer('revenue_cents').nullable();
    table.integer('commission_cents').nullable();
    table.integer('net_cents').nullable();
    table.timestamp('paid_at').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());

    table.index(['bookingId']);
    table.index(['userId']);
    table.index(['machineId']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('payments');
};
