const { EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

async function checkAndRemoveBans(client) {
  try {
    console.log('Starting unban job check...');
    
    const now = Date.now();
    console.log('Current time:', new Date(now).toISOString());

    // Get all queue bans
    const allBans = await query('punishments', 'raw', `
      SELECT * FROM punishments 
      WHERE type = 'ban'
      AND expiration IS NOT NULL
    `);

    console.log('All current queue bans:', allBans);

    // Check which bans are expired
    const expiredBans = allBans.filter(ban => {
      const expTime = new Date(ban.expiration).getTime();
      const timeLeft = expTime - now;
      console.log(`Ban ID: ${ban.discord_id} - Expires: ${new Date(expTime).toISOString()} - Time left: ${timeLeft}ms`);
      return timeLeft <= 0;
    });

    console.log('Number of expired bans found:', expiredBans.length);

    for (const ban of expiredBans) {
      console.log('Processing expired queue ban:', ban);

      try {
        // Remove from database
        await query('punishments', 'raw', `
          DELETE FROM punishments 
          WHERE discord_id = ? 
          AND type = 'ban'
        `, [ban.discord_id]);
        console.log(`Removed queue ban record for user ${ban.discord_id} from database`);

        if (!config.alertID) {
          console.error('Alert channel ID is not defined in config!');
          continue;
        }

        // Send notification about queue ban expiry
        const alertChannel = await client.channels.fetch(config.alertID);
        if (!alertChannel) {
          console.error('Could not find alert channel with ID:', config.alertID);
          continue;
        }

        const unbanEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('Queue Ban Expired')
          .setDescription(`<@${ban.discord_id}>'s queue ban has expired`)
          .addFields(
            { name: 'Original Ban Reason', value: ban.reason || 'No reason provided' }
          )
          .setTimestamp()
          .setFooter({ text: `${client.user.username}` });

        await alertChannel.send({ embeds: [unbanEmbed] });
        console.log('Sent queue ban expiry notification to alert channel');

      } catch (error) {
        console.error(`Error processing queue ban expiration for user ${ban.discord_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Queue Unban Job Error:', error);
  }
}

module.exports = { checkAndRemoveBans };