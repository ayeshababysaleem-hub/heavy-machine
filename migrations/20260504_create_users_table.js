exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.string('id').primary();
    table.string('name').notNullable().defaultTo('');
    table.string('email').notNullable().unique();
    table.string('password').notNullable();
    table.string('role').notNullable().defaultTo('Customer');
    table.boolean('verified').notNullable().defaultTo(false);
    table.string('cnic').nullable();
    table.string('verificationToken').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
