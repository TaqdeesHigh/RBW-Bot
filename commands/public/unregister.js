const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    .setName('unregister')
    .setDescription('Unregister yourself from the database'),

  async execute(interaction, client) {
    const userId = interaction.user.id;

    const userExists = await checkUserExists(userId);

    if (!userExists) {
      return interaction.reply({ content: "You are not registered in the database.", ephemeral: true });
    }

    const warningEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Warning: Unregistration')
      .setDescription('Are you sure you want to unregister? This action will delete all your stats and registration information from the database.')
      .setFooter({ text: 'This action cannot be undone.' });

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('unregister_proceed')
          .setLabel('Proceed')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('unregister_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [warningEmbed],
      components: [buttons],
      ephemeral: true
    });
  },
};

function checkUserExists(userId) {
  return new Promise((resolve, reject) => {
    conn.query(
      'SELECT * FROM registered WHERE discord_id = ?',
      [userId],
      (err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        resolve(result.length > 0);
      }
    );
  });
}