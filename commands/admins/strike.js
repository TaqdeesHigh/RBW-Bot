const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Manage user strikes')
    .addSubcommand(subcommand =>
      subcommand
        .setName('give')
        .setDescription('Give strikes to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to give strikes to')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Number of strikes to give')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(25)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove strikes from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove strikes from')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Number of strikes to remove')
            .setRequired(true)
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Set exact number of strikes for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to edit strikes for')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('New total number of strikes')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(25))),

  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.reply({
        content: 'You do not have permission to manage strikes.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
      // Get current strikes
      const currentStrikes = await query('punishments', 'raw', `
        SELECT * FROM punishments 
        WHERE discord_id = ? 
        AND type = 'strike'
        LIMIT 1
      `, [user.id]);

      let newStrikeCount = 0;
      let actionType = '';

      switch (subcommand) {
        case 'give':
          newStrikeCount = (currentStrikes[0]?.amount || 0) + amount;
          actionType = 'given';
          break;
        case 'remove':
          newStrikeCount = Math.max(0, (currentStrikes[0]?.amount || 0) - amount);
          actionType = 'removed';
          break;
        case 'edit':
          newStrikeCount = amount;
          actionType = 'set to';
          break;
      }

      // Update or insert strikes
      if (currentStrikes.length > 0) {
        await query('punishments', 'raw', `
          UPDATE punishments 
          SET amount = ?
          WHERE discord_id = ? 
          AND type = 'strike'
        `, [newStrikeCount, user.id]);
      } else {
        await query('punishments', 'raw', `
          INSERT INTO punishments 
          (discord_id, type, amount, issued_by) 
          VALUES (?, 'strike', ?, ?)
        `, [user.id, newStrikeCount, interaction.user.id]);
      }

      // Handle automatic bans based on strike count
      if (newStrikeCount >= 2) {
        const banHours = Math.min(newStrikeCount, 25);
        const duration = banHours * 3600000; // Convert hours to milliseconds
        const expirationTime = new Date(Date.now() + duration);

        // If 25 strikes, make it permanent
        if (newStrikeCount >= 25) {
          await query('punishments', 'raw', `
            INSERT INTO punishments 
            (discord_id, type, expiration, reason, issued_by) 
            VALUES (?, 'ban', NULL, ?, ?)
          `, [
            user.id,
            `Automatic permanent ban due to reaching 25 strikes`,
            interaction.user.id
          ]);
        } else {
          await query('punishments', 'raw', `
            INSERT INTO punishments 
            (discord_id, type, expiration, reason, issued_by) 
            VALUES (?, 'ban', ?, ?, ?)
          `, [
            user.id,
            expirationTime,
            `Automatic ${banHours} hour ban due to ${newStrikeCount} strikes`,
            interaction.user.id
          ]);
        }

        // Create ban embed
        const banEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(`Automatic Ban: ${user.username}`)
          .setDescription(`User has received ${newStrikeCount} strikes`)
          .addFields(
            { name: 'Ban Duration', value: newStrikeCount >= 25 ? 'Permanent' : `${banHours} hours` },
            { name: 'Reason', value: `Accumulated ${newStrikeCount} strikes` }
          )
          .setTimestamp()
          .setFooter({ text: interaction.client.user.username });

        // Send ban notification
        const alertChannel = interaction.client.channels.cache.get(config.alertID);
        if (alertChannel) {
          await alertChannel.send({ embeds: [banEmbed] });
        }
      }

      // Create strike update embed
      const strikeEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Strike Update')
        .setDescription(`${user.username}'s strikes ${actionType} ${amount}`)
        .addFields(
          { name: 'Current Strike Count', value: `${newStrikeCount}` },
          { name: 'Updated By', value: interaction.user.toString() }
        )
        .setTimestamp()
        .setFooter({ text: interaction.client.user.username });

      // Send strike notification
      const alertChannel = interaction.client.channels.cache.get(config.alertID);
      if (alertChannel) {
        await alertChannel.send({ embeds: [strikeEmbed] });
      }

      await interaction.reply({
        content: `Successfully ${actionType} ${amount} strike(s) for ${user}. Current total: ${newStrikeCount}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Strike command error:', error);
      await interaction.reply({
        content: 'An error occurred while managing strikes.',
        ephemeral: true
      });
    }
  },
};