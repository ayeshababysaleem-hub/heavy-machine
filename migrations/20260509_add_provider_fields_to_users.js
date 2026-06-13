// This migration was referenced in the DB but was missing from the repo.
// Create no-op migration to restore consistency. The real migration (if needed)
// should be added or restored from backups.
exports.up = function(knex) {
  // no-op: migration already applied previously
  return Promise.resolve();
};

exports.down = function(knex) {
  // no-op
  return Promise.resolve();
};
