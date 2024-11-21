const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    // Create registered table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registered (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mc_user VARCHAR(255) NOT NULL,
        discord_user VARCHAR(255) NOT NULL,
        discord_id VARCHAR(255) NOT NULL UNIQUE
      )
    `);

    // Create stats table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL UNIQUE,
        elo INT DEFAULT 0,
        wins INT DEFAULT 0,
        lost INT DEFAULT 0,
        wlr FLOAT DEFAULT 0,
        rank VARCHAR(255),
        games INT DEFAULT 0,
        mvp INT DEFAULT 0,
        bed_breaker INT DEFAULT 0
      )
    `);

    // Create others table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS others (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        category_id VARCHAR(255),
        channel_4v4 VARCHAR(255),
        channel_3v3 VARCHAR(255),
        channel_2v2 VARCHAR(255)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_number VARCHAR(255) NOT NULL UNIQUE,
        gamemode VARCHAR(10) NOT NULL,
        status ENUM('queued', 'in_progress', 'submitted', 'validated', 'voided') DEFAULT 'queued',
        team1_members JSON,
        team2_members JSON,
        winning_team VARCHAR(10),
        mvp VARCHAR(255),
        proof_image VARCHAR(255),
        bed_breaker TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        category_id VARCHAR(255),
        voice_channel_id VARCHAR(255),
        text_channel_id VARCHAR(255)
      )
    `);


    await connection.query(`
      CREATE TABLE IF NOT EXISTS punishments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL,
        type ENUM('strike', 'ban') NOT NULL,
        amount INT DEFAULT 0,
        expiration TIMESTAMP NULL,
        reason TEXT,
        issued_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    connection.release();
  }
}

async function healthCheck() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    console.log('Health check passed');
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

async function query(table, operation, ...args) {
  let retries = 3;
  while (retries > 0) {
    try {
      const connection = await pool.getConnection();
      try {
        switch (operation) {
          case 'find':
            const [rows] = await connection.query(`SELECT * FROM ${table} WHERE ?`, args[0]);
            return rows;
          case 'findOne':
            const [row] = await connection.query(`SELECT * FROM ${table} WHERE ? LIMIT 1`, args[0]);
            return row[0];
          case 'updateOne':
            const [updateResult] = await connection.query(`UPDATE ${table} SET ? WHERE ?`, [args[1].$set, args[0]]);
            return { modifiedCount: updateResult.affectedRows };
          case 'raw':
            const [rawRows] = await connection.query(...args);
            return rawRows;
          case 'insertOne':
            const [insertResult] = await connection.query(`INSERT INTO ${table} SET ?`, args[0]);
            return { insertId: insertResult.insertId };
          case 'deleteOne':
          case 'deleteMany':
            const [deleteResult] = await connection.query(`DELETE FROM ${table} WHERE ?`, args[0]);
            return { deletedCount: deleteResult.affectedRows };
          case 'select':
            const [selectRows] = await connection.query(args[0]);
            return selectRows;
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`Database query error (attempts left: ${retries}):`, error);
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached. Unable to connect to database.');
}

// Health check interval
setInterval(healthCheck, 30000);

// Initialize database on startup
initDatabase();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    await pool.end();
    console.log('All database connections closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

module.exports = { query };