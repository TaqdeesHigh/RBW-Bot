const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
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
      
      function createEmbed(title, description, color = '#0099ff') {
        return new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color)
          .setTimestamp();
      }

      if (res.data.banned === true) {
        const embed = createEmbed('Registration Failed', 'You are banned from the server.', '#FF0000');
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }
     
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
          const embed = createEmbed('Registration Failed', 'You are already registered.', '#FFA500');
          return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
        if (mcuser) {
          const embed = createEmbed('Registration Failed', 'Player already registered.', '#FFA500');
          return interaction.editReply({ embeds: [embed], ephemeral: true });
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
            const embed = createEmbed('Registration Successful', 'You are now registered and your stats have been initialized.', '#00FF00');
            return interaction.editReply({ embeds: [embed], ephemeral: true });
          } catch (error) {
            console.error(error);
            const embed = createEmbed('Registration Failed', 'Error registering user.', '#FF0000');
            return interaction.editReply({ embeds: [embed], ephemeral: true });
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
      const embed = createEmbed('Registration Failed', 'Player not found.', '#FF0000');
      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
  },
};