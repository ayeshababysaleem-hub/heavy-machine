exports.up = function(knex) {
  return knex.schema.createTable('machines', function(table) {
    table.string('id').primary();
    table.string('name').notNullable().defaultTo('');
    table.string('type').nullable();
    table.string('model').nullable();
    table.string('location').nullable();
    table.string('image').nullable();
    table.text('description').nullable();
    table.string('ownerId').nullable();
    table.string('status').notNullable().defaultTo('approved');
    table.decimal('price', 14, 2).nullable();
    table.string('currentBookingId').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('machines');
};
