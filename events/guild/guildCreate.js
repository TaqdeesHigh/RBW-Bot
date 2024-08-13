const { ChannelType, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql');
const env = require('dotenv').config();

const conn = mysql.createPool({
  port: process.env.DB_PORT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

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

function saveToDatabase(guildId, categoryId, channelIds) {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO others (guild_id, category_id, channel_4v4, channel_3v3, channel_2v2) VALUES (?, ?, ?, ?, ?)';
    const values = [guildId, categoryId, channelIds['4v4'], channelIds['3v3'], channelIds['2v2']];

    conn.query(sql, values, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}