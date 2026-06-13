exports.up = function(knex) {
  return Promise.all([
    knex.schema.createTable('backups', function(table){
      table.string('id').primary();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.text('data');
    }),
    knex.schema.createTable('reports', function(table){
      table.string('id').primary();
      table.string('type').notNullable();
      table.string('filename').nullable();
      table.integer('rows').nullable();
      table.text('content');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('reports'),
    knex.schema.dropTableIfExists('backups')
  ]);
};
