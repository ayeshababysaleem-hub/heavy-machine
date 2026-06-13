exports.up = function(knex) {
  return knex.schema.createTable('inspections', function(table) {
    table.string('id').primary();
    table.string('bookingId').notNullable();
    table.string('inspectedBy').notNullable();
    table.text('notes').nullable();
    table.string('condition').notNullable().defaultTo('good'); // good, damaged, lost
    table.decimal('depositReturned', 14, 2).nullable().defaultTo(0);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('inspections');
};
