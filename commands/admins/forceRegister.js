const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { query } = require("../../database");
const axios = require("axios");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("force_register")
    .setDescription("Force register a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to register")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("player")
        .setDescription("The Minecraft player name")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user");
    const playerName = interaction.options.getString("player");

    try {
      const existingUser = await query('registered', 'findOne', { discord_id: targetUser.id });
      if (existingUser) {
        return interaction.editReply({
          content: `${targetUser.username} is already registered.`,
          ephemeral: true,
        });
      }

      await axios.get(`https://api.ngmc.co/v1/players/${playerName}`);

      const existingPlayer = await query('registered', 'findOne', { mc_user: playerName });
      if (existingPlayer) {
        return interaction.editReply({
          content: `The Minecraft player ${playerName} is already registered to another user.`,
          ephemeral: true,
        });
      }

      await query('registered', 'insertOne', {
        mc_user: playerName,
        discord_user: targetUser.username,
        discord_id: targetUser.id
      });

      await query('stats', 'insertOne', {
        discord_id: targetUser.id
      });

      const member = await interaction.guild.members.fetch(targetUser.id);
      await updateNickname(member, playerName, 0);

      return interaction.editReply({
        content: `Successfully registered ${targetUser.username} as ${playerName}.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      return interaction.editReply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },
};

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