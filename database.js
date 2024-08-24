// database.js
const { MongoClient } = require('mongodb');
const env = require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db(process.env.DB_NAME);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

const dbPromise = connectToDatabase();

async function query(collection, operation, ...args) {
  const db = await dbPromise;
  const coll = db.collection(collection);
  
  switch (operation) {
    case 'find':
      return coll.find(...args).toArray();
    case 'findOne':
      return coll.findOne(...args);
    case 'insertOne':
      return coll.insertOne(...args);
    case 'updateOne':
      return coll.updateOne(...args);
    case 'deleteOne':
      return coll.deleteOne(...args);
    case 'deleteMany':
      return coll.deleteMany(...args);
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

module.exports = { query };