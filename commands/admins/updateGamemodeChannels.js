const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../database');
const { updateRankRoles } = require('../../eloCalc.js');
const errorHandler = require('../../handlers/errorHandler.js');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update various server settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('channels')
                .setDescription('Update gamemode channels')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('roles')
                .setDescription('Create/update rank roles')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rank-roles')
                .setDescription('Create/update all rank roles')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'channels') {
            await updateGamemodeChannels(interaction);
        } else if (interaction.options.getSubcommand() === 'rank-roles') {
            await createRankRoles(interaction);
        }
    },
};

async function createRankRoles(interaction) {
  try {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      // First, delete all existing rank roles from both server and database
      await interaction.editReply('Deleting existing rank roles...');
      
      // Get existing roles from database
      const existingRoles = await query(null, 'raw', 'SELECT * FROM rank_roles WHERE guild_id = ?', [guild.id]);
      
      // Delete roles from server
      for (const roleData of existingRoles) {
          const role = guild.roles.cache.get(roleData.role_id);
          if (role) {
              await role.delete().catch(console.error);
          }
      }
      
      // Clear database entries
      await query(null, 'raw', 'DELETE FROM rank_roles WHERE guild_id = ?', [guild.id]);
      
      await interaction.editReply('Existing roles deleted. Creating new roles...');

      // Get all ranks and format them
      const ranks = Object.values(config.ranks).map(rank => {
          const [tier, number] = rank.match(/([a-zA-Z]+)(\d)/).slice(1);
          const romanNumerals = { '1': 'I', '2': 'II', '3': 'III' };
          return {
              configName: rank,
              displayName: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${romanNumerals[number]}`
          };
      });

      // Sort ranks in reverse order (lowest to highest)
      const rankOrder = [
          'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald',
          'Sapphire', 'Ruby', 'Crystal', 'Opal', 'Amethyst', 'Obsidian',
          'Veteran', 'Quartz', 'Topaz', 'Netherite'
      ].reverse();

      ranks.sort((a, b) => {
          const rankA = rankOrder.indexOf(a.displayName.split(' ')[0]);
          const rankB = rankOrder.indexOf(b.displayName.split(' ')[0]);
          if (rankA === rankB) {
              return b.displayName.endsWith('III') ? 1 : b.displayName.endsWith('I') ? -1 : 0;
          }
          return rankB - rankA;
      });

      const tierColors = {
          'Bronze': '#cd7f32',
          'Silver': '#c0c0c0',
          'Gold': '#ffd700',
          'Platinum': '#e5e4e2',
          'Diamond': '#b9f2ff',
          'Emerald': '#50c878',
          'Sapphire': '#0f52ba',
          'Ruby': '#e0115f',
          'Crystal': '#a7d8de',
          'Opal': '#a8c3bc',
          'Amethyst': '#9966cc',
          'Obsidian': '#3d3d3d',
          'Veteran': '#b80000',
          'Quartz': '#ffccf9',
          'Topaz': '#ffc87c',
          'Netherite': '#4a4a4a'
      };

      let created = 0;
      
      // Create new roles from bottom to top
      for (let i = ranks.length - 1; i >= 0; i--) {
          const rank = ranks[i];
          const tier = rank.displayName.split(' ')[0];
          const color = tierColors[tier] || '#99aab5';
          
          const role = await guild.roles.create({
              name: rank.displayName,
              color: color,
              position: 1,
              reason: 'Automated rank role creation'
          });
          
          created++;

          // Save to database
          await query(null, 'raw', `
              INSERT INTO rank_roles 
              (guild_id, rank_name, role_id, display_name, position) 
              VALUES (?, ?, ?, ?, ?)
          `, [guild.id, rank.configName, role.id, rank.displayName, i]);
      }

      await interaction.editReply(
          `Rank roles update complete!\n` +
          `Deleted all existing rank roles\n` +
          `Created ${created} new roles\n` +
          `All roles have been saved to the database.`
      );

  } catch (error) {
      console.error('Error creating rank roles:', error);
      await interaction.editReply('An error occurred while creating rank roles. Please check the console for details.');
  }
}

async function updateGamemodeChannels(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

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
      createdChannels[`channel_${channelInfo.name}`] = channel.id;
    }

    console.log('Created channels:', createdChannels);

    await updateDatabase(guild.id, category.id, createdChannels);

    await interaction.editReply('Gamemode channels have been updated successfully.');

  } catch (error) {
    console.error('Error updating gamemode channels:', error);
    await interaction.editReply('An error occurred while updating gamemode channels. Please try again later.');
  }
}

async function updateDatabase(guildId, categoryId, channelIds) {
  const updateData = {
    guild_id: guildId,
    category_id: categoryId,
    channel_4v4: channelIds.channel_4v4,
    channel_3v3: channelIds.channel_3v3,
    channel_2v2: channelIds.channel_2v2
  };

  try {
    const existingRecord = await query('others', 'findOne', { guild_id: guildId });

    if (existingRecord) {
      await query('others', 'updateOne', { guild_id: guildId }, { $set: updateData });
      console.log('Updated existing record');
    } else {
      await query('others', 'insertOne', updateData);
      console.log('Inserted new record');
    }
  } catch (error) {
    console.error('Error updating database:', error);
    throw error;
  }
}

async function getExistingData(guildId) {
  return query('others', 'findOne', { guild_id: guildId });
}

async function deleteExistingChannels(guild, data) {
  const channelsToDelete = [data.channel_4v4, data.channel_3v3, data.channel_2v2, data.category_id];
  for (const channelId of channelsToDelete) {
    if (channelId) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) await channel.delete().catch(console.error);
    }
  }
}