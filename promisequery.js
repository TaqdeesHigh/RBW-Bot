const mysql = require('mysql')
const settings = require('./config.json');
const dbConfig = settings.db;
const db = mysql.createPool({
  port: dbConfig.port,
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  multipleStatements: true
});

function query(sqlQuery) {
    return new Promise((resolve, reject) => {
      db.query(sqlQuery, (error, results, fields) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }
  module.exports = query;