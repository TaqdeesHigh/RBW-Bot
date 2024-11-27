const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { query } = require('../../database');
const { sendUnregisteredWarning } = require('../Warnings/warning');
const crypto = require('crypto');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      // Only handle when someone joins a channel
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        const guildId = newState.guild.id;

        console.log(`Voice state update: User ${newState.member.user.tag} joined channel ${channel.name}`);

        const channelData = await getChannelData(guildId);
        if (!channelData) {
          console.log('No channel data found for guild:', guildId);
          return;
        }
        
        const gamemodeChannels = {
          '4v4': channelData.channel_4v4,
          '3v3': channelData.channel_3v3,
          '2v2': channelData.channel_2v2
        };

        console.log('Current channel:', channel.id);
        console.log('Available gamemode channels:', gamemodeChannels);

        const gamemode = Object.keys(gamemodeChannels).find(mode => gamemodeChannels[mode] === channel.id);
        if (!gamemode) {
          console.log('Not a gamemode channel');
          return;
        }

        console.log(`Detected gamemode: ${gamemode}`);
        
        const requiredPlayers = parseInt(gamemode.charAt(0)) * 2;
        console.log(`Required players: ${requiredPlayers}, Current players: ${channel.members.size}`);

        if (channel.members.size === requiredPlayers) {
          const issues = await checkRegisteredUsers(channel.members);

          const unregistered = issues.filter(issue => issue.type === 'unregistered').map(issue => issue.member);
          const banned = issues.filter(issue => issue.type === 'banned').map(issue => issue.member);

          if (unregistered.length > 0) {
            await sendUnregisteredWarning(channel, unregistered, gamemode);
            return;
          }

          if (banned.length > 0) {
            const bannedMessages = banned.map(ban => `${ban.displayName} is banned from participating. Reason: ${ban.reason || 'No reason provided.'}`);
            
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Banned Users')
              .setDescription('The following players are currently banned from participating in the game:')
              .addFields(
                { name: 'Banned Players', value: bannedMessages.join('\n') }
              )
              .setTimestamp()
              .setFooter({ text: `Game Mode: ${gamemode}`, iconURL: newState.guild.iconURL() });

            await channel.send({ embeds: [embed] });
            return;
          }

          if (unregistered.length === 0 && banned.length === 0) {
            await createQueuedGame(newState.guild, channel.members, gamemode, client);
          }
        }
      }
    } catch (error) {
      console.error('Error in voiceStateUpdate:', error);
    }
  },
};

async function getChannelData(guildId) {
  try {
    return await query('others', 'findOne', { guild_id: guildId });
  } catch (error) {
    console.error('Error getting channel data:', error);
    return null;
  }
}

async function checkRegisteredUsers(members) {
  const issues = [];

  try {
    for (const [id, member] of members) {
      const isRegistered = await query('registered', 'findOne', { discord_id: id });
      if (!isRegistered) {
        issues.push({ type: 'unregistered', member });
        continue;
      }

      const now = new Date();
      const formattedNow = now.toISOString().slice(0, 19).replace('T', ' ');

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
  } catch (error) {
    console.error('Error checking registered users:', error);
  }

  return issues;
}

async function createQueuedGame(guild, members, gamemode, client) {
  const gameNumber = generateGameNumber();

  try {
    // Store original members immediately
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
          deny: [PermissionsBitField.Flags.ViewChannel], // Hide from everyone
        },
        ...Array.from(members.values()).map(member => ({
          id: member.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages], // Only queue members can see and send messages
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

    // Try to move members who are in voice channels
    for (const member of members.values()) {
      try {
        if (member.voice?.channel) {
          await member.voice.setChannel(voiceChannel);
        }
      } catch (error) {
        console.log(`Note: Couldn't move ${member.user.tag} to game channel - they may have left voice`);
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

    console.log(`Created queued game for ${gamemode} with number: ${gameNumber}`);
  } catch (error) {
    console.error('Error creating queued game:', error);
    throw error;
  }
}

function generateGameNumber() {
  return crypto.randomBytes(3).toString('hex');
}

module.exports.createQueuedGame = createQueuedGame;