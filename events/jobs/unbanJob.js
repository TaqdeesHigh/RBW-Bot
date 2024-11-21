const { EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

async function checkAndRemoveBans(client) {
  try {
    console.log('Starting unban job check...');

    // Fetch all currently active bans
    const activeBans = await query('punishments', 'raw', `
      SELECT * FROM punishments 
      WHERE type = 'ban' 
      AND expiration <= NOW()
    `);

    console.log('Currently Active Bans:', activeBans);

    // Print banned users with 1-minute duration
    const oneMuniteBans = await query('punishments', 'raw', `
      SELECT * FROM punishments 
      WHERE type = 'ban' 
      AND TIMESTAMPDIFF(MINUTE, created_at, expiration) = 1
    `);

    console.log('1-Minute Duration Bans:', oneMuniteBans);

    for (const ban of activeBans) {
      // Remove the user from the server
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) {
        try {
          await guild.members.unban(ban.discord_id, 'Ban duration expired');
        } catch (unbanError) {
          console.error(`Failed to unban user ${ban.discord_id}:`, unbanError);
        }
      }

      // Remove the ban from the database
      await query('punishments', 'deleteOne', { 
        id: ban.id
      });

      // Create unban notification embed
      const unbanEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('User Unbanned')
        .setDescription(`<@${ban.discord_id}> has been automatically unbanned`)
        .addFields(
          { name: 'Original Ban Reason', value: ban.reason || 'No reason provided' }
        )
        .setFooter({ text: `${client.user.username} | ${new Date().toLocaleString()}` });

      // Send unban notification to alert channel
      const alertChannel = client.channels.cache.get(config.alertID);
      if (alertChannel) {
        await alertChannel.send({ embeds: [unbanEmbed] });
      }
    }
  } catch (error) {
    console.error('Comprehensive Unban Job Error:', error);
  }
}

module.exports = { checkAndRemoveBans };