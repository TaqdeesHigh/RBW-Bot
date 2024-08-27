const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { query } = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("force_unregister")
    .setDescription("Force unregister a user (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to unregister")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user");

    try {
      // Check if the user is registered
      const existingUser = await query('registered', 'findOne', { discord_id: targetUser.id });
      if (!existingUser) {
        return interaction.editReply({
          content: `${targetUser.username} is not registered.`,
          ephemeral: true,
        });
      }

      // Unregister the user
      await query('registered', 'deleteOne', { discord_id: targetUser.id });

      // Remove stats
      await query('stats', 'deleteOne', { discord_id: targetUser.id });

      // Reset nickname
      const member = await interaction.guild.members.fetch(targetUser.id);
      try {
        if (member.guild.members.me.permissions.has('ManageNicknames') && 
            member.manageable) {
          await member.setNickname(null);
        }
      } catch (error) {
        console.error("Failed to reset nickname:", error);
      }

      return interaction.editReply({
        content: `Successfully unregistered ${targetUser.username}.`,
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