const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers
  ] 
});

const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

let players = {};

const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register as a Bedwars player')
    .addStringOption(option => 
      option.setName('ign')
        .setDescription('Your in-game name')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your Bedwars stats'),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the Bedwars leaderboard'),
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

async function loadPlayers() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
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
    const response = await axios.get(`https://api.ngmc.co/v1/players/${ign}`);
    const playerData = response.data;
    
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

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }
})();

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await loadPlayers();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'register') {
    const ign = interaction.options.getString('ign');
    const success = await registerPlayer(interaction.user.id, ign);
    if (success) {
      await interaction.reply(`Successfully registered ${ign} as a Bedwars player!`);
    } else {
      await interaction.reply('Failed to register. Please check your IGN and try again.');
    }
  } else if (!players[interaction.user.id]) {
    await interaction.reply('You need to register first. Use /register to sign up.');
  } else if (commandName === 'stats') {
    const player = players[interaction.user.id];
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`${player.ign}'s Bedwars Stats`)
      .addFields(
        { name: 'ELO', value: player.elo.toString(), inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  } else if (commandName === 'leaderboard') {
    const sortedPlayers = Object.entries(players)
      .sort((a, b) => b[1].elo - a[1].elo)
      .slice(0, 10);
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Bedwars Leaderboard')
      .setDescription(sortedPlayers.map((p, i) => `${i + 1}. ${p[1].ign} - ${p[1].elo} ELO`).join('\n'));
    await interaction.reply({ embeds: [embed] });
  }
});

client.on('guildMemberAdd', async member => {
  if (players[member.id]) {
    const player = players[member.id];
    // Here you can add code to restore roles based on ELO
    console.log(`Restored data for ${player.ign}`);
  }
});

client.login(process.env.BOT_TOKEN);