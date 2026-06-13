exports.up = function(knex) {
  // Drop the inspections table when applying this migration
  return knex.schema.dropTableIfExists('inspections');
};

exports.down = function(knex) {
  // Recreate the inspections table if rolling back
  return knex.schema.createTable('inspections', function(table) {
    table.string('id').primary();
    table.string('bookingId').notNullable();
    table.string('inspectedBy').notNullable();
    table.text('notes').nullable();
    table.string('condition').notNullable().defaultTo('good');
    table.decimal('depositReturned', 14, 2).nullable().defaultTo(0);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};
