const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');
const ms = require('ms');

// Custom duration validation function
function validateDuration(durationInput) {
  // Allow days, hours, and minutes
  const validUnits = ['d', 'h', 'm', 'day', 'hour', 'min', 'days', 'hours', 'minutes'];
  // Require at least one valid unit
  const match = durationInput.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) return false;
  
  const [, amount, unit] = match;
  
  // Check if the unit is valid
  return validUnits.some(validUnit => 
    unit.toLowerCase().startsWith(validUnit[0])
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from queuing')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => 
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('duration')
        .setDescription('Ban duration (e.g., 1d, 2h, 30m)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.reply({ content: 'You do not have permission to ban.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Validate duration
    if (!validateDuration(durationInput)) {
      return interaction.reply({ 
        content: 'Invalid duration. Use units like 1d, 2h, 30m', 
        ephemeral: true 
      });
    }

    try {
      // In your ban command's execute function:
      const duration = ms(durationInput);
      if (!duration) {
        return interaction.reply({ 
          content: 'Invalid duration format. Use format like 1d, 2h, 30m', 
          ephemeral: true 
        });
      }

      const expirationTime = new Date(Date.now() + duration);

      console.log('Creating ban with expiration:', expirationTime.toISOString());

      // Insert ban record
      await query('punishments', 'raw', `
        INSERT INTO punishments 
        (discord_id, type, expiration, reason, issued_by) 
        VALUES (?, 'ban', ?, ?, ?)
      `, [
        user.id,
        expirationTime,
        reason,
        interaction.user.id
      ]);

      // Create embed
      const banEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`${user.username} Has been banned`)
        .setDescription(`**Reason:**\n${reason}`)
        .addFields(
          { name: 'Ban Duration', value: `${durationInput}`, inline: true },
          { name: 'Expires', value: expirationTime.toLocaleString(), inline: true }
        )
        .setFooter({ text: `${interaction.client.user.username} | ${new Date().toLocaleString()}` });

      // Send embed to the alert channel specified in config
      const alertChannel = interaction.client.channels.cache.get(config.alertID);
      if (alertChannel) {
        await alertChannel.send({ embeds: [banEmbed] });
      }

      await interaction.reply({ 
        content: `${user} has been banned from queuing until ${expirationTime.toLocaleString()}`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Ban error:', error);
      await interaction.reply({ 
        content: 'An error occurred while banning the user.', 
        ephemeral: true 
      });
    }
  }
};