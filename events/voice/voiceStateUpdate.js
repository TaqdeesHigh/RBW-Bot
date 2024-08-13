const { ChannelType, PermissionFlagsBits, EnbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed, EmbedBuilder, TextChannel } = require('discord.js');
const mysql = require('mysql');
const env = require('dotenv').config();

const conn = mysql.createPool({
  port: process.env.DB_PORT,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

let gameCounter = 0;

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
  gameCounter++;
  const gameNumber = gameCounter;
  const categoryName = `Game-${gamemode}-${gameNumber}`;

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
      name: `game-${gameNumber}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    const textChannel = await guild.channels.create({
      name: `game-${gameNumber}`,
      type: ChannelType.GuildText,
      parent: category.id,
    });

    const newVoiceChannel = category.children.cache.find(ch => ch.type === ChannelType.GuildVoice);
    for (const [, member] of members) {
      await member.voice.setChannel(newVoiceChannel);
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Team Selection')
      .setDescription('Choose which method you want to use to pick teams:');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('random:0:0')
          .setLabel('Random (0)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('choose:0:0')
          .setLabel('Choose (0)')
          .setStyle(ButtonStyle.Primary)
      );
  
    await textChannel.send({ embeds: [embed], components: [row] });
  
    console.log(`Created game channels for ${gamemode} with number: ${gameNumber}`);
  } catch (error) {
    console.error('Error creating game channels:', error);
  }
}