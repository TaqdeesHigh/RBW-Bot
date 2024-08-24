const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unregister')
    .setDescription('Unregister yourself from the database'),

  async execute(interaction, client) {
    const userId = interaction.user.id;

    const userExists = await checkUserExists(userId);

    if (!userExists) {
      return interaction.reply({ content: "You are not registered in the database.", ephemeral: true });
    }

    const warningEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Warning: Unregistration')
      .setDescription('Are you sure you want to unregister? This action will delete all your stats and registration information from the database.')
      .setFooter({ text: 'This action cannot be undone.' });

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('unregister_proceed')
          .setLabel('Proceed')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('unregister_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [warningEmbed],
      components: [buttons],
      ephemeral: true
    });
  },
};

async function checkUserExists(userId) {
  const result = await query('registered', 'findOne', { discord_id: userId });
  return result !== null;
}