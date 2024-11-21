const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');
const { sendUnregisteredWarning } = require('../Warnings/warning');
const crypto = require('crypto');

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
        const unregisteredUsers = await checkRegisteredUsers(channel.members);
        if (unregisteredUsers.length > 0) {
          await sendUnregisteredWarning(channel, unregisteredUsers, gamemode);
        } else {
          await createQueuedGame(newState.guild, channel.members, gamemode, client);
        }
      }
    }
  },
};

async function getChannelData(guildId) {
  return query('others', 'findOne', { guild_id: guildId });
}

async function checkRegisteredUsers(members) {
  const unregisteredUsers = [];
  for (const [id, member] of members) {
    const isRegistered = await query('registered', 'findOne', { discord_id: id });
    if (!isRegistered) {
      unregisteredUsers.push(member);
    }
  }
  return unregisteredUsers;
}

async function createQueuedGame(guild, members, gamemode, client) {
  // Generate a unique game number
  const gameNumber = generateGameNumber();

  try {
    // Save game to database
    const gameRecord = {
      game_number: gameNumber,
      gamemode: gamemode,
      status: 'queued',
      team1_members: JSON.stringify(Array.from(members.keys()).slice(0, members.size / 2)),
      team2_members: JSON.stringify(Array.from(members.keys()).slice(members.size / 2)),
    };

    const savedGame = await query('games', 'insertOne', gameRecord);

    // Create category and channels
    const category = await guild.channels.create({
      name: `Game-${gamemode}-${gameNumber}`,
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

    const voiceChannel = await guild.channels.create({
      name: `game-${gameNumber}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    const textChannel = await guild.channels.create({
      name: `game-${gameNumber}`,
      type: ChannelType.GuildText,
      parent: category.id,
    });

    // Update game record with channel IDs
    await query('games', 'updateOne', 
      { id: savedGame.insertId }, 
      { $set: { 
        category_id: category.id, 
        voice_channel_id: voiceChannel.id, 
        text_channel_id: textChannel.id 
      }}
    );

    // Move members to voice channel
    for (const [, member] of members) {
      await member.voice.setChannel(voiceChannel);
    }

    // Send team selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Team Selection')
      .setDescription('Choose which method you want to use to pick teams:');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`random:${gameNumber}`)
          .setLabel('Random')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`choose:${gameNumber}`)
          .setLabel('Choose')
          .setStyle(ButtonStyle.Primary)
      );
    
    await textChannel.send({ embeds: [embed], components: [row] });

    console.log(`Created queued game for ${gamemode} with number: ${gameNumber}`);
  } catch (error) {
    console.error('Error creating queued game:', error);
  }
}

function generateGameNumber() {
  // Generate a unique 6-character game number
  return crypto.randomBytes(3).toString('hex');
}

module.exports.createQueuedGame = createQueuedGame;