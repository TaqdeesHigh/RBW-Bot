const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { ThemeColor } = require("../../config.json");
const axios = require("axios");
const { query } = require("../../database");

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

      const res = await axios.get(`https://api.ngmc.co/v1/players/${name}`);
      
      async function checkDiscordUser(discord_id) {
        const result = await query('registered', 'findOne', { discord_id });
        return result !== null;
      }

      async function checkMinecraftUser(mc_user) {
        const result = await query('registered', 'findOne', { mc_user });
        return result !== null;
      }

      async function insertData() {
        const mcuser = await checkMinecraftUser(name);
        const discorduser = await checkDiscordUser(interaction.user.id);

        if (discorduser) {
          return interaction.editReply({
            content: "You are already registered",
            ephemeral: true,
          });
        }

        if (mcuser) {
          return interaction.editReply({
            content: "Player already registered",
            ephemeral: true,
          });
        }

        if (!mcuser && !discorduser) {
          try {
            await query('registered', 'insertOne', {
              mc_user: name,
              discord_user: interaction.user.username,
              discord_id: interaction.user.id
            });

            await query('stats', 'insertOne', {
              discord_id: interaction.user.id
            });

            await updateNickname(interaction.member, name, 0);
            return interaction.editReply({
              content: "You are now registered and your stats have been initialized",
              ephemeral: true,
            });
          } catch (error) {
            console.error(error);
            return interaction.editReply({
              content: "Error registering user",
              ephemeral: true,
            });
          }
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

      await insertData();
    } catch (error) {
      console.log(error);
      return interaction.editReply({
        content: "Player not found",
        ephemeral: true,
      });
    }
  },
};