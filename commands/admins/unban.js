const { SlashCommandBuilder } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from queuing')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('User to unban')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.reply({ content: 'You do not have permission to unban.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    try {
      // Check for active ban
      const activeBan = await query('punishments', 'findOne', { 
        discord_id: user.id, 
        type: 'ban',
        expiration: { '>' : new Date() }
      });

      if (!activeBan) {
        return interaction.reply({ 
          content: 'This user is not currently banned.', 
          ephemeral: true 
        });
      }

      // Remove the ban by updating expiration to current time
      await query('punishments', 'updateOne', 
        { 
          discord_id: user.id, 
          type: 'ban',
          expiration: { '>' : new Date() }
        }, 
        { $set: { expiration: new Date() } }
      );

      await interaction.reply({ 
        content: `${user} has been unbanned and can now queue.`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Unban error:', error);
      await interaction.reply({ 
        content: 'An error occurred while unbanning the user.', 
        ephemeral: true 
      });
    }
  }
};