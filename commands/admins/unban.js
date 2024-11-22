const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from queuing')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('User to unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)),

  async execute(interaction) {
    // Check if user has permission to unban
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.reply({ 
        content: 'You do not have permission to unban users.', 
        ephemeral: true 
      });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Check if user is actually banned
      const banCheck = await query('punishments', 'raw', `
        SELECT * FROM punishments 
        WHERE discord_id = ? 
        AND type = 'ban'
        LIMIT 1
      `, [user.id]);

      if (!banCheck || banCheck.length === 0) {
        return interaction.reply({
          content: `${user} is not currently banned from queuing.`,
          ephemeral: true
        });
      }

      // Remove the ban from database
      await query('punishments', 'raw', `
        DELETE FROM punishments 
        WHERE discord_id = ? 
        AND type = 'ban'
      `, [user.id]);

      // Create embed for the unban notification
      const unbanEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('User Queue Ban Removed')
        .setDescription(`${user} has been unbanned from queuing`)
        .addFields(
          { name: 'Unbanned By', value: `${interaction.user}` },
          { name: 'Reason', value: reason }
        )
        .setTimestamp()
        .setFooter({ text: `${interaction.client.user.username}` });

      // Send notification to alert channel
      const alertChannel = interaction.client.channels.cache.get(config.alertID);
      if (alertChannel) {
        await alertChannel.send({ embeds: [unbanEmbed] });
      }

      // Reply to command
      await interaction.reply({
        content: `Successfully unbanned ${user} from queuing.`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Unban command error:', error);
      await interaction.reply({
        content: 'An error occurred while trying to unban the user.',
        ephemeral: true
      });
    }
  },
};