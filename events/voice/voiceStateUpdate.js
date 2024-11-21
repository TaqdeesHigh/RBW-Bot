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
        const issues = await checkRegisteredUsers(channel.members);

        const unregistered = issues.filter(issue => issue.type === 'unregistered').map(issue => issue.member);
        const banned = issues.filter(issue => issue.type === 'banned').map(issue => issue.member);

        if (unregistered.length > 0) {
          await sendUnregisteredWarning(channel, unregistered, gamemode);
        }

        if (banned.length > 0) {
          const bannedMessages = banned.map(ban => `${ban.displayName} is banned from participating. Reason: ${ban.reason || 'No reason provided.'}`);
          
          const embed = new EmbedBuilder()
            .setColor('#FF0000') // Red color for banned users
            .setTitle('Banned Users')
            .setDescription('The following players are currently banned from participating in the game:')
            .addFields(
              { name: 'Banned Players', value: bannedMessages.join('\n') }
            )
            .setTimestamp()
            .setFooter({ text: `Game Mode: ${gamemode}`, iconURL: newState.guild.iconURL() });

          await channel.send({ embeds: [embed] });
        }

        if (unregistered.length === 0 && banned.length === 0) {
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
  const issues = []; // Store issues as objects with type and member

  for (const [id, member] of members) {
    // Check if the user is registered
    const isRegistered = await query('registered', 'findOne', { discord_id: id });
    if (!isRegistered) {
      issues.push({ type: 'unregistered', member });
      continue;
    }

    // Format the current timestamp as "YYYY-MM-DD HH:MM:SS"
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 19).replace('T', ' ');

    // Query the database for an active ban
    const sql = `
      SELECT * 
      FROM punishments 
      WHERE discord_id = ? 
        AND type = 'ban' 
        AND expiration > ?
      LIMIT 1
    `;
    const activeBan = await query(null, 'raw', sql, [id, formattedNow]);

    if (activeBan.length > 0) {
      issues.push({ type: 'banned', member, reason: activeBan[0].reason });
    }
  }

  return issues;
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
