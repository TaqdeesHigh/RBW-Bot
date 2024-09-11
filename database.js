const databaseManager = require('./databaseManager');

async function query(collection, operation, ...args) {
  return databaseManager.query(collection, operation, ...args);
}

module.exports = { query };