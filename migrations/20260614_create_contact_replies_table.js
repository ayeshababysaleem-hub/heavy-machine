exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('contact_replies');
  if (exists) return;
  await knex.schema.createTable('contact_replies', function(t){
    t.string('id', 255).primary();
    t.string('contactId', 255).notNullable().index();
    t.string('repliedBy', 255).nullable().index();
    t.text('message').nullable();
    t.timestamp('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  const exists = await knex.schema.hasTable('contact_replies');
  if (!exists) return;
  await knex.schema.dropTable('contact_replies');
};
