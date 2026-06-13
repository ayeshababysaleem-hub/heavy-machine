exports.up = function(knex) {
  return knex.schema.alterTable('contacts', function(table) {
    table.text('reply').nullable();
    table.timestamp('repliedAt').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('contacts', function(table) {
    table.dropColumn('reply');
    table.dropColumn('repliedAt');
  });
};
