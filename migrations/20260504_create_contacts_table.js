exports.up = function(knex) {
  return knex.schema.createTable('contacts', function(table) {
    table.string('id').primary();
    table.string('name').notNullable().defaultTo('');
    table.string('email').nullable();
    table.string('phone').nullable();
    table.text('message').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('contacts');
};
