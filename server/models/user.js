var db = require('../db');
var bcrypt = require('bcrypt-nodejs');


var User = module.exports

User.findByUsername = function (username) {
  return db('users').where({ username: username }).limit(1)
    .then(function (rows) {
      return rows[0]
    })
}

User.findById = function (id) {
  return db('users').where({ id: id }).limit(1)
    .then(function (rows) {
      return rows[0]
    })
}

User.create = function (incomingAttrs) {

  // Copy object to avoid mutation
  var attrs = Object.assign({}, incomingAttrs);


  return hashPassword(attrs.password)
    .then(function (passwordHash) {

      attrs.password_hash = passwordHash
      delete attrs.password

      return db('users').insert(attrs)
    })
    .then(function (result) {
      // Prepare new user for the outside world
      attrs.id = result[0];
      return attrs;
    });
  };

User.comparePassword = function (passwordHashFromDatabase, attemptedPassword) {

  return new Promise(function (resolve, reject) {

    bcrypt.compare(attemptedPassword, passwordHashFromDatabase, function(err, res) {
      if (err) reject(err)
      else     resolve(res)
    });
  })
  };

function hashPassword (password) {

  return new Promise(function (resolve, reject) {

    bcrypt.hash(password, null, null, function(err, hash) {
      if (err) reject(err)
      else     resolve(hash)
    });
  })
  };
