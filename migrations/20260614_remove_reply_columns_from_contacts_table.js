exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('contacts');
  if (!exists) return;

  const hasReply = await knex.schema.hasColumn('contacts', 'reply');
  if (hasReply) {
    await knex.schema.table('contacts', function(t){ t.dropColumn('reply'); });
  }

  const hasRepliedAt = await knex.schema.hasColumn('contacts', 'repliedAt');
  if (hasRepliedAt) {
    await knex.schema.table('contacts', function(t){ t.dropColumn('repliedAt'); });
  }
};

exports.down = async function(knex) {
  const exists = await knex.schema.hasTable('contacts');
  if (!exists) return;

  const hasReply = await knex.schema.hasColumn('contacts', 'reply');
  if (!hasReply) {
    await knex.schema.table('contacts', function(t){ t.text('reply').nullable(); });
  }

  const hasRepliedAt = await knex.schema.hasColumn('contacts', 'repliedAt');
  if (!hasRepliedAt) {
    await knex.schema.table('contacts', function(t){ t.timestamp('repliedAt').nullable(); });
  }
};
