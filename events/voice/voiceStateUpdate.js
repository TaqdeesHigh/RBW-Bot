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
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    if (!oldState.channelId && newState.channelId) {
      const channel = newState.channel;
      const guildId = newState.guild.id;

      const channelData = await getChannelData(guildId);
      if (!channelData) return;
      const gamemodeChannels = {
        '4v4': channelData.channel_4v4,
        '3v3': channelData.channel_3v3,
        '2v2': channelData.channel_2v2
      };

      const gamemode = Object.keys(gamemodeChannels).find(mode => gamemodeChannels[mode] === channel.id);
      if (!gamemode) return;
      const requiredPlayers = parseInt(gamemode.charAt(0)) * 2;
      if (channel.members.size === requiredPlayers) {
        await createGameChannels(newState.guild, channel.members, gamemode);
      }
    }
  },
};

async function getChannelData(guildId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM others WHERE guild_id = ?';
    conn.query(sql, [guildId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
}

async function createGameChannels(guild, members, gamemode) {
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const categoryName = `Game-${gamemode}-${uniqueId}`;

  try {
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        ...Array.from(members.values()).map(member => ({
          id: member.id,
          allow: [PermissionFlagsBits.ViewChannel],
        })),
      ],
    });

    await guild.channels.create({
      name: `game-${uniqueId}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    await guild.channels.create({
      name: `game-${uniqueId}`,
      type: ChannelType.GuildText,
      parent: category.id,
    });

    const newVoiceChannel = category.children.cache.find(ch => ch.type === ChannelType.GuildVoice);
    for (const [, member] of members) {
      await member.voice.setChannel(newVoiceChannel);
    }

    console.log(`Created game channels for ${gamemode} with ID: ${uniqueId}`);
  } catch (error) {
    console.error('Error creating game channels:', error);
  }
}