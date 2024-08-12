const axios = require('axios');

async function getPlayerData(ign) {
  try {
    const response = await axios.get(`https://api.ngmc.co/v1/players/${ign}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
}

module.exports = {
  getPlayerData
};