const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');
const { sendUnregisteredWarning } = require('../Warnings/warning');

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
        const unregisteredUsers = await checkRegisteredUsers(channel.members);
        if (unregisteredUsers.length > 0) {
          await sendUnregisteredWarning(channel, unregisteredUsers, gamemode);
        } else {
          await createGameChannels(newState.guild, channel.members, gamemode);
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

async function handleButtonInteraction(interaction) {
  if (!interaction.isButton()) return;

  const [action, gamemode] = interaction.customId.split(':');

  if (action === 'start_game') {
    await interaction.update({ content: 'Starting the game...', components: [] });
    await createGameChannels(interaction.guild, interaction.message.mentions.members, gamemode);
  } else if (action === 'cancel_game') {
    await interaction.update({ content: 'Game cancelled.', components: [] });
  }
}

// Export the handleButtonInteraction function
module.exports.handleButtonInteraction = handleButtonInteraction;
