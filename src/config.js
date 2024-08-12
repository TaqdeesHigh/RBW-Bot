require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  DATA_DIR: process.env.DATA_DIR || './data',
  PLAYERS_FILE: 'players.json'
};