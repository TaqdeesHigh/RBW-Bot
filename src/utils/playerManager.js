const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const apiService = require('./apiService');

const PLAYERS_FILE = path.join(config.DATA_DIR, config.PLAYERS_FILE);

let players = {};

async function loadPlayers() {
  try {
    await fs.mkdir(config.DATA_DIR, { recursive: true });
    const data = await fs.readFile(PLAYERS_FILE, 'utf-8');
    players = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading players:', error);
    }
    players = {};
  }
}

async function savePlayers() {
  try {
    await fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2));
  } catch (error) {
    console.error('Error saving players:', error);
  }
}

async function registerPlayer(userId, ign) {
  try {
    const playerData = await apiService.getPlayerData(ign);
    
    players[userId] = {
      ign: playerData.name,
      uuid: playerData.uuid,
      elo: 0
    };
    
    await savePlayers();
    return true;
  } catch (error) {
    console.error('Error registering player:', error);
    return false;
  }
}

function getPlayer(userId) {
  return players[userId];
}

function getAllPlayers() {
  return players;
}

module.exports = {
  loadPlayers,
  savePlayers,
  registerPlayer,
  getPlayer,
  getAllPlayers
};