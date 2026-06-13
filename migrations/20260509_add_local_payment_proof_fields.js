exports.up = async function(knex) {
  // Add payment proof fields only if they do not already exist (idempotent)
  const hasPaymentMethod = await knex.schema.hasColumn('bookings', 'payment_method');
  const hasLocalPaymentId = await knex.schema.hasColumn('bookings', 'local_payment_id');
  const hasTransactionId = await knex.schema.hasColumn('bookings', 'transaction_id');
  const hasSenderNumber = await knex.schema.hasColumn('bookings', 'sender_number');
  const hasScreenshot = await knex.schema.hasColumn('bookings', 'screenshot');

  return knex.schema.alterTable('bookings', function(table) {
    if (!hasPaymentMethod) table.string('payment_method').nullable();
    if (!hasLocalPaymentId) table.string('local_payment_id').nullable();
    if (!hasTransactionId) table.string('transaction_id').nullable();
    if (!hasSenderNumber) table.string('sender_number').nullable();
    if (!hasScreenshot) table.string('screenshot').nullable();
  });
};

exports.down = async function(knex) {
  // Drop columns only if present
  const hasPaymentMethod = await knex.schema.hasColumn('bookings', 'payment_method');
  const hasLocalPaymentId = await knex.schema.hasColumn('bookings', 'local_payment_id');
  const hasTransactionId = await knex.schema.hasColumn('bookings', 'transaction_id');
  const hasSenderNumber = await knex.schema.hasColumn('bookings', 'sender_number');
  const hasScreenshot = await knex.schema.hasColumn('bookings', 'screenshot');

  return knex.schema.alterTable('bookings', function(table) {
    if (hasPaymentMethod) table.dropColumn('payment_method');
    if (hasLocalPaymentId) table.dropColumn('local_payment_id');
    if (hasTransactionId) table.dropColumn('transaction_id');
    if (hasSenderNumber) table.dropColumn('sender_number');
    if (hasScreenshot) table.dropColumn('screenshot');
  });
};
