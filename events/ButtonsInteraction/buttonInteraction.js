const { query } = require('../../database');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'unregister_proceed') {
      await unregisterUser(interaction.user.id);
      await interaction.update({ content: 'You have been successfully unregistered.', embeds: [], components: [] });
    } else if (interaction.customId === 'unregister_cancel') {
      await interaction.update({ content: 'Unregistration cancelled.', embeds: [], components: [] });
    }
  },
};

async function unregisterUser(userId) {
  await query('registered', 'deleteOne', { discord_id: userId });
  await query('stats', 'deleteOne', { discord_id: userId });
}