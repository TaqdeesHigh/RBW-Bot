const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Embed,
  time,
} = require("discord.js");
const { ThemeColor } = require("../../config.json");
const axios = require("axios");
const mysql = require("mysql");
const env = require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register command")
    .addStringOption((option) =>
      option.setName("name").setDescription("Your name").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const name = interaction.options.getString("name");

      axios
        .get(`https://api.ngmc.co/v1/players/${name}`)
        .then((res) => {
          const conn = mysql.createPool({
            port: process.env.DB_PORT,
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
          });

          function checkDiscordUser(discord_id) {
            return new Promise((resolve, reject) => {
              conn.query(
                `SELECT * FROM registered WHERE discord_id = ${discord_id}`,
                (err, result) => {
                  if (err) {
                    console.log(err);
                    reject(err);
                  }

                  if (result.length > 0) {
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                }
              );
            });
          }

          function checkMinecraftUser(mc_user) {
            return new Promise((resolve, reject) => {
              conn.query(
                `SELECT * FROM registered WHERE mc_user = '${mc_user}'`,
                (err, result) => {
                  if (err) {
                    console.log(err);
                    reject(err);
                  }

                  if (result.length > 0) {
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                }
              );
            });
          }

          async function insertData() {
            const mcuser = await checkMinecraftUser(name);
            const discorduser = await checkDiscordUser(interaction.user.id);
          
            if (discorduser == true) {
              return interaction.editReply({
                content: "You are already registered",
                ephemeral: true,
              });
            }
          
            if (mcuser == true) {
              return interaction.editReply({
                content: "Player already registered",
                ephemeral: true,
              });
            }
          
            if (mcuser == false && discorduser == false) {
              conn.query(
                `INSERT INTO registered (mc_user, discord_user, discord_id) VALUES ('${name}', '${interaction.user.username}', ${interaction.user.id})`,
                async (err, result) => {
                  if (err) {
                    console.log(err);
                    return interaction.editReply({
                      content: "Error registering user",
                      ephemeral: true,
                    });
                  }
          
                  if (result.affectedRows > 0) {
                    // Insert into stats table
                    conn.query(
                      `INSERT INTO stats (discord_id) VALUES (${interaction.user.id})`,
                      async (statsErr, statsResult) => {
                        if (statsErr) {
                          console.log(statsErr);
                          return interaction.editReply({
                            content: "Error creating stats",
                            ephemeral: true,
                          });
                        }
          
                        if (statsResult.affectedRows > 0) {
                          // Update the user's nickname
                          await updateNickname(interaction.member, name, 0);
                          return interaction.editReply({
                            content: "You are now registered and your stats have been initialized",
                            ephemeral: true,
                          });
                        }
                      }
                    );
                  }
                }
              );
            }
          }
          
          async function updateNickname(member, name, elo) {
            try {
              if (member.guild.members.me.permissions.has('ManageNicknames') && 
                  member.manageable) {
                await member.setNickname(`${elo} - ${name}`);
              } else {
                console.log("Can't change nickname for this user");
              }
            } catch (error) {
              console.error("Failed to update nickname:", error);
            }
          }
          insertData();
        })
        .catch((err) => {
          return interaction.editReply({
            content: "Player not found",
            ephemeral: true,
          });
        });
    } catch (error) {
      console.log(error);
    }
  },
};
