
exports.up = function(knex, Promise) {

  return Promise.all([

    knex.schema.createTable('breweries', function(table) {
        table.string('id').primary();
        table.integer('likes');
    }),

    knex.schema.createTable('beers', function(table){
        table.string('id').primary();
        table.integer('likes');
    }),

    knex.schema.createTable('users', function(table){
        table.increments('id').primary();
        table.string('username').unique();
        table.string('password');
    }),

    knex.schema.createTable('sessions', function(table){
        table.string('id').primary();
        table.string('username').unique();
    }),

   knex.schema.createTable('brewery_likes', function(table){  
        table.string('user_id');
        table.string('brewery_id');
        table.primary(['user_id', 'brewery_id']);
    }),

   knex.schema.createTable('beer_likes', function(table){  
        table.string('user_id');
        table.string('beer_id');
        table.primary(['user_id', 'beer_id']);
    })

	])

};
  

exports.down = function(knex, Promise) {  
  return Promise.all([
      knex.schema.dropTable('beers'),
      knex.schema.dropTable('breweries'),
      knex.schema.dropTable('users'),
      knex.schema.dropTable('sessions'),
      knex.schema.dropTable('brewery_likes'),
      knex.schema.dropTable('beer_likes')
  ])
};
