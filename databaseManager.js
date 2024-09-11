const config = require('./config.json');
const MongoClient = require('mongodb').MongoClient;
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
  constructor() {
    this.type = config.database.type;
    this.connection = null;
  }

  async connect() {
    switch (this.type) {
      case 'mongodb':
        this.connection = await MongoClient.connect(config.database.connection.mongodb.uri);
        this.db = this.connection.db(config.database.connection.mongodb.dbName);
        break;
      case 'mysql':
        this.connection = await mysql.createConnection(config.database.connection.mysql);
        break;
      case 'json':
        // Ensure the data directory exists
        await fs.mkdir(config.database.connection.json.directory, { recursive: true });
        break;
      default:
        throw new Error('Unsupported database type');
    }
  }

  async query(collection, operation, ...args) {
    switch (this.type) {
      case 'mongodb':
        return this.db.collection(collection)[operation](...args);
      case 'mysql':
        return this.mysqlQuery(collection, operation, ...args);
      case 'json':
        return this.jsonQuery(collection, operation, ...args);
    }
  }

  async mysqlQuery(collection, operation, ...args) {
    let sql, values;
    switch (operation) {
      case 'find':
      case 'findOne':
        sql = `SELECT * FROM ${collection} WHERE ?`;
        values = [args[0]];
        break;
      case 'insertOne':
        sql = `INSERT INTO ${collection} SET ?`;
        values = [args[0]];
        break;
      case 'updateOne':
        sql = `UPDATE ${collection} SET ? WHERE ?`;
        values = [args[1].$set, args[0]];
        break;
      case 'deleteOne':
        sql = `DELETE FROM ${collection} WHERE ?`;
        values = [args[0]];
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    const [rows] = await this.connection.execute(sql, values);
    return operation === 'findOne' ? rows[0] : rows;
  }

  async jsonQuery(collection, operation, ...args) {
    const filePath = path.join(config.database.connection.json.directory, `${collection}.json`);
    let data = [];
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    let result;
    switch (operation) {
      case 'find':
        result = data.filter(item => this.matchQuery(item, args[0]));
        break;
      case 'findOne':
        result = data.find(item => this.matchQuery(item, args[0]));
        break;
      case 'insertOne':
        const newItem = { ...args[0], _id: Date.now().toString() };
        data.push(newItem);
        result = { insertedId: newItem._id };
        break;
      case 'updateOne':
        const index = data.findIndex(item => this.matchQuery(item, args[0]));
        if (index !== -1) {
          data[index] = { ...data[index], ...args[1].$set };
          result = { modifiedCount: 1 };
        } else {
          result = { modifiedCount: 0 };
        }
        break;
      case 'deleteOne':
        const initialLength = data.length;
        data = data.filter(item => !this.matchQuery(item, args[0]));
        result = { deletedCount: initialLength - data.length };
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return result;
  }

  matchQuery(item, query) {
    return Object.keys(query).every(key => item[key] === query[key]);
  }

  async close() {
    if (this.connection && this.type !== 'json') {
      await this.connection.close();
    }
  }
}

module.exports = new DatabaseManager();