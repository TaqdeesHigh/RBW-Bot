const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
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
      await updateGamemodeChannels(interaction);
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

    await interaction.editReply('Gamemode channels have been updated successfully.');
  } catch (error) {
    console.error('Error updating gamemode channels:', error);
    await interaction.editReply('An error occurred while updating gamemode channels.');
  }
}

function getExistingData(guildId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM others WHERE guild_id = ?';
    conn.query(sql, [guildId], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
}

async function deleteExistingChannels(guild, data) {
  const channelsToDelete = [data.channel_4v4, data.channel_3v3, data.channel_2v2, data.category_id];
  for (const channelId of channelsToDelete) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.delete().catch(console.error);
  }
}

function updateDatabase(guildId, categoryId, channelIds) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO others (guild_id, category_id, channel_4v4, channel_3v3, channel_2v2)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        category_id = VALUES(category_id),
        channel_4v4 = VALUES(channel_4v4),
        channel_3v3 = VALUES(channel_3v3),
        channel_2v2 = VALUES(channel_2v2)
    `;
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