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
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'unregister_proceed') {
      await unregisterUser(interaction.user.id);
      await interaction.update({ content: 'You have been successfully unregistered.', embeds: [], components: [] });
    } else if (interaction.customId === 'unregister_cancel') {
      await interaction.update({ content: 'Unregistration cancelled.', embeds: [], components: [] });
    }
  },
};

function unregisterUser(userId) {
    return new Promise((resolve, reject) => {
      conn.query('DELETE FROM registered WHERE discord_id = ?', [userId], (err, result) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        conn.query('DELETE FROM stats WHERE discord_id = ?', [userId], (err, result) => {
          if (err) {
            console.error(err);
            return reject(err);
          }
          resolve();
        });
      });
    });
}