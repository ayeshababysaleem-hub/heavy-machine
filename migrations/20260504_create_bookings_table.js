exports.up = function(knex) {
  return knex.schema.createTable('bookings', function(table) {
    table.string('id').primary();
    table.string('machineId').notNullable();
    table.string('userId').notNullable();
    table.date('startDate').nullable();
    table.date('endDate').nullable();
    table.integer('durationDays').nullable();
    table.string('location').nullable();
    table.string('name').nullable();
    table.string('email').nullable();
    table.string('cnic').nullable();
    table.string('address').nullable();
    table.string('phone').nullable();
    table.string('status').notNullable().defaultTo('pending');
    table.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('bookings');
};
