const { SlashCommandBuilder } = require('discord.js');
const playerManager = require('../utils/playerManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register')
    .addStringOption(option => 
      option.setName('ign')
        .setDescription('Your in-game name')
        .setRequired(true)),
  async execute(interaction) {
    const ign = interaction.options.getString('ign');
    const success = await playerManager.registerPlayer(interaction.user.id, ign);
    if (success) {
      await interaction.reply(`Successfully registered ${ign}!`);
    } else {
      await interaction.reply('Failed to register. Please check your IGN and try again.');
    }
  },
};