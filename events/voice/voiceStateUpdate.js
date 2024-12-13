const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { query } = require('../../database');
const { sendUnregisteredWarning } = require('../Warnings/warning');
const crypto = require('crypto');
const config = require('../../config.json');

const queueCooldowns = new Map();
const userStatusCache = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      if (!newState.channelId) return;
      
      const channel = newState.channel;
      const guildId = newState.guild.id;
      const member = newState.member;

      const channelData = await getChannelData(guildId);
      if (!channelData) return;

      const gamemodeChannels = {
        '4v4': channelData.channel_4v4,
        '3v3': channelData.channel_3v3,
        '2v2': channelData.channel_2v2
      };

      const gamemode = Object.keys(gamemodeChannels).find(mode => gamemodeChannels[mode] === channel.id);
      if (!gamemode) return;

      // Immediately check user status when they join
      if (oldState.channelId !== newState.channelId) {
        const issues = await checkUserStatus(member.id);
        
        if (issues.type === 'unregistered') {
          await sendUnregisteredWarning(channel, [member], gamemode);
          return;
        }

        if (issues.type === 'banned') {
          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Banned User')
            .setDescription(`${member.displayName} is banned from participating. Reason: ${issues.reason || 'No reason provided.'}`)
            .setTimestamp()
            .setFooter({ text: `Game Mode: ${gamemode}`, iconURL: newState.guild.iconURL() });

          await channel.send({ embeds: [embed] });
          return;
        }

        // Cache the user's status
        userStatusCache.set(member.id, issues);
      }

      // Queue logic starts here
      const cooldownTime = queueCooldowns.get(member.id);
      if (cooldownTime && Date.now() < cooldownTime) {
        const remainingTime = Math.ceil((cooldownTime - Date.now()) / 1000);
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Queue Cooldown')
          .setDescription(`You must wait ${remainingTime} seconds before queuing for another game.`)
          .setTimestamp();
        
        await channel.send({ embeds: [embed], content: member.toString() });
        return;
      }

      const requiredPlayers = parseInt(gamemode.charAt(0)) * 2;
      if (channel.members.size === requiredPlayers) {
        // Check if any member is unregistered
        const memberStatuses = await Promise.all(
          Array.from(channel.members.values()).map(member => checkUserStatus(member.id))
        );
        
        if (memberStatuses.some(status => status.type === 'unregistered')) {
          const unregisteredMembers = channel.members.filter((member, index) => 
            memberStatuses[index].type === 'unregistered'
          );
          await sendUnregisteredWarning(channel, Array.from(unregisteredMembers.values()), gamemode);
          return;
        }

        if (memberStatuses.some(status => status.type === 'banned')) {
          const bannedMembers = channel.members.filter((member, index) => 
            memberStatuses[index].type === 'banned'
          );
          for (const member of bannedMembers.values()) {
            const status = memberStatuses.find(s => s.type === 'banned');
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Banned User')
              .setDescription(`${member.displayName} is banned from participating. Reason: ${status.reason || 'No reason provided.'}`)
              .setTimestamp()
              .setFooter({ text: `Game Mode: ${gamemode}`, iconURL: newState.guild.iconURL() });

            await channel.send({ embeds: [embed] });
          }
          return;
        }

        // Quick check if any member is in active game
        const memberPromises = Array.from(channel.members.keys()).map(memberId => checkActiveGame(memberId));
        const activeGames = await Promise.all(memberPromises);
        
        if (activeGames.some(game => game !== null)) {
          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Queue Error')
            .setDescription('One or more players are already in a queued game.')
            .setTimestamp();
          
          await channel.send({ embeds: [embed] });
          return;
        }

        await createQueuedGame(newState.guild, channel.members, gamemode, client);
        
        // Set 15-second cooldown for all members
        const cooldownDuration = 15000; // 15 seconds
        for (const [memberId] of channel.members) {
          queueCooldowns.set(memberId, Date.now() + cooldownDuration);
          setTimeout(() => queueCooldowns.delete(memberId), cooldownDuration);
        }
      }
    } catch (error) {
      console.error('Error in voiceStateUpdate:', error);
    }
  },
};

async function checkActiveGame(userId) {
  try {
    const sql = `
      SELECT game_number, status, created_at 
      FROM games 
      WHERE (
        JSON_CONTAINS(team1_members, ?) 
        OR JSON_CONTAINS(team2_members, ?)
      )
      AND status = 'queued'
      AND TIMESTAMPDIFF(SECOND, created_at, NOW()) <= 30
      LIMIT 1
    `;
    const result = await query(null, 'raw', sql, [JSON.stringify(userId), JSON.stringify(userId)]);
    
    if (result.length === 0) {
      return null;
    }

    // If the game is older than 30 seconds, allow new queue
    const gameAge = Math.floor((Date.now() - new Date(result[0].created_at).getTime()) / 1000);
    if (gameAge > 30) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Error checking active game:', error);
    return null;
  }
}
async function checkUserStatus(userId) {
  try {
    const isRegistered = await query('registered', 'findOne', { discord_id: userId });
    if (!isRegistered) {
      return { type: 'unregistered' };
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `
      SELECT * 
      FROM punishments 
      WHERE discord_id = ? 
        AND type = 'ban' 
        AND expiration > ?
      LIMIT 1
    `;
    const activeBan = await query(null, 'raw', sql, [userId, now]);

    if (activeBan.length > 0) {
      return { type: 'banned', reason: activeBan[0].reason };
    }

    return { type: 'ok' };
  } catch (error) {
    console.error('Error checking user status:', error);
    return { type: 'error' };
  }
}

async function getChannelData(guildId) {
  try {
    return await query('others', 'findOne', { guild_id: guildId });
  } catch (error) {
    console.error('Error getting channel data:', error);
    return null;
  }
}

async function createQueuedGame(guild, members, gamemode, client) {
  const gameNumber = generateGameNumber();

  for (const [memberId, member] of members) {
    const userStatus = await checkUserStatus(memberId);
    if (userStatus.type === 'unregistered') {
      // If any member is unregistered, send warning and don't create the game
      await sendUnregisteredWarning(member.voice.channel, [member], gamemode);
      return;
    }
    if (userStatus.type === 'banned') {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Banned User')
        .setDescription(`${member.displayName} is banned from participating. Reason: ${userStatus.reason || 'No reason provided.'}`)
        .setTimestamp()
        .setFooter({ text: `Game Mode: ${gamemode}`, iconURL: guild.iconURL() });

      await member.voice.channel.send({ embeds: [embed] });
      return;
    }
  }

  try {
    const originalMemberIds = Array.from(members.keys());
    const halfSize = Math.ceil(originalMemberIds.length / 2);
    
    const gameRecord = {
      game_number: gameNumber,
      gamemode: gamemode,
      status: 'queued',
      team1_members: JSON.stringify(originalMemberIds.slice(0, halfSize)),
      team2_members: JSON.stringify(originalMemberIds.slice(halfSize)),
      created_at: new Date()
    };

    const savedGame = await query('games', 'insertOne', gameRecord);

    const category = await guild.channels.create({
      name: `Game-${gamemode}-${gameNumber}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel],
          deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        {
          id: config.scorerID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        {
          id: config.rbwStaffID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        ...Array.from(members.values()).map(member => ({
          id: member.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        })),
      ],
    });

    const voiceChannel = await guild.channels.create({
      name: `game-${gameNumber}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel],
          deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        {
          id: config.scorerID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        {
          id: config.rbwStaffID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        },
        ...Array.from(members.values()).map(member => ({
          id: member.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
        })),
      ],
    });

    const textChannel = await guild.channels.create({
      name: `game-${gameNumber}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: config.scorerID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: config.rbwStaffID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        ...Array.from(members.values()).map(member => ({
          id: member.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        })),
      ],
    });

    await query('games', 'updateOne', 
      { id: savedGame.insertId }, 
      { $set: {
        category_id: category.id, 
        voice_channel_id: voiceChannel.id, 
        text_channel_id: textChannel.id
      }}
    );

    for (const member of members.values()) {
      try {
        if (member.voice?.channel) {
          await member.voice.setChannel(voiceChannel);
        }
      } catch (error) {
        console.log(`Note: Couldn't move ${member.user.tag} to game channel`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Team Selection')
      .setDescription('Choose which method you want to use to pick teams:')
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`random:0:0:${gameNumber}`)
          .setLabel('Random (0)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`choose:0:0:${gameNumber}`)
          .setLabel('Choose (0)')
          .setStyle(ButtonStyle.Primary)
      );
    
    await textChannel.send({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error creating queued game:', error);
    throw error;
  }
}

function generateGameNumber() {
  return crypto.randomBytes(3).toString('hex');
}

module.exports.createQueuedGame = createQueuedGame;