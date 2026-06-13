exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.string('jazzcashAccount').nullable();
    table.string('easypaisaAccount').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('jazzcashAccount');
    table.dropColumn('easypaisaAccount');
  });
};
