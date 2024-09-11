const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config.json');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Update various server settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('channels')
        .setDescription('Update gamemode channels')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
      if (interaction.options.getSubcommand() === 'channels') {
        try {
          await updateGamemodeChannels(interaction);
        } catch (error) {
          console.error('Error in updateGamemodeChannels:', error);
          await interaction.editReply('An error occurred while updating gamemode channels. Please check the logs for more information.');
        }
      }
    },
};

async function updateGamemodeChannels(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    const existingData = await getExistingData(guild.id);

    if (existingData) {
      await deleteExistingChannels(guild, existingData);
    }

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

    await updateDatabase(guild.id, category.id, createdChannels);
    console.log('Channels created and JSON file updated successfully');

    await interaction.editReply('Gamemode channels have been updated successfully.');
  } catch (error) {
    console.error('Error updating gamemode channels:', error);
    await interaction.editReply('An error occurred while updating gamemode channels. Please check the logs for more information.');
    throw error;
  }
}

async function getExistingData(guildId) {
  try {
    const filePath = path.join(config.database.connection.json.directory, 'others.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    return data.find(item => item.guild_id === guildId);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist yet
    }
    throw error;
  }
}
async function deleteExistingChannels(guild, data) {
  const channelsToDelete = [data.channel_4v4, data.channel_3v3, data.channel_2v2, data.category_id];
  for (const channelId of channelsToDelete) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.delete().catch(console.error);
  }
}

async function updateDatabase(guildId, categoryId, channelIds) {
  try {
    const filePath = path.join(config.database.connection.json.directory, 'others.json');
    let data = [];

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const existingIndex = data.findIndex(item => item.guild_id === guildId);
    const updatedItem = {
      guild_id: guildId,
      category_id: categoryId,
      channel_4v4: channelIds['4v4'],
      channel_3v3: channelIds['3v3'],
      channel_2v2: channelIds['2v2']
    };

    if (existingIndex !== -1) {
      data[existingIndex] = updatedItem;
    } else {
      data.push(updatedItem);
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log('JSON file updated successfully');
  } catch (error) {
    console.error('Error updating JSON file:', error);
    throw error;
  }
}