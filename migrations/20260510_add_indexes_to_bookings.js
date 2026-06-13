exports.up = function(knex) {
  // Add indexes to speed up reminders and lookup queries
  return knex.schema.hasTable('bookings').then(function(exists) {
    if (!exists) return Promise.resolve();
    return knex.schema.alterTable('bookings', function(table) {
      table.index('endDate', 'idx_bookings_endDate');
      table.index('userId', 'idx_bookings_userId');
      table.index('machineId', 'idx_bookings_machineId');
    }).then(function(){
      return knex.schema.hasTable('machines');
    }).then(function(existsMachines){
      if (!existsMachines) return Promise.resolve();
      return knex.schema.alterTable('machines', function(table) {
        table.index('ownerId', 'idx_machines_ownerId');
      });
    });
  });
};

exports.down = function(knex) {
  // Drop the indexes added in up()
  return knex.schema.hasTable('bookings').then(function(exists) {
    if (!exists) return Promise.resolve();
    return knex.schema.alterTable('bookings', function(table) {
      table.dropIndex('endDate', 'idx_bookings_endDate');
      table.dropIndex('userId', 'idx_bookings_userId');
      table.dropIndex('machineId', 'idx_bookings_machineId');
    }).then(function(){
      return knex.schema.hasTable('machines');
    }).then(function(existsMachines){
      if (!existsMachines) return Promise.resolve();
      return knex.schema.alterTable('machines', function(table) {
        table.dropIndex('ownerId', 'idx_machines_ownerId');
      });
    });
  });
};
