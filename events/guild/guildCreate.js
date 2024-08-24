const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    try {
      const category = await guild.channels.create({
        name: 'Gamemodes',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
      const channels = [
        { name: '4v4', limit: 8 },
        { name: '3v3', limit: 6 },
        { name: '2v2', limit: 4 }
      ];
      const createdChannels = {};

      for (const channelInfo of channels) {
        const channel = await guild.channels.create({
          name: channelInfo.name,
          type: ChannelType.GuildVoice,
          parent: category.id,
          userLimit: channelInfo.limit
        });
        createdChannels[channelInfo.name] = channel.id;
      }

      await saveToDatabase(guild.id, category.id, createdChannels);

      console.log(`Created Gamemodes category and channels in ${guild.name}`);
    } catch (error) {
      console.error('Error setting up channels:', error);
    }
  },
};

async function saveToDatabase(guildId, categoryId, channelIds) {
  await query('others', 'updateOne', 
    { guild_id: guildId },
    { $set: {
        category_id: categoryId,
        channel_4v4: channelIds['4v4'],
        channel_3v3: channelIds['3v3'],
        channel_2v2: channelIds['2v2']
      }
    },
    { upsert: true }
  );
}