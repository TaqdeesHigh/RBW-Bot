const { EmbedBuilder } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'unregister_proceed') {
      await unregisterUser(interaction.user.id, interaction);
    } else if (interaction.customId === 'unregister_cancel') {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Unregistration Cancelled')
        .setDescription('Your unregistration request has been cancelled.');

      await interaction.update({ embeds: [cancelEmbed], components: [] });
    }
  },
};