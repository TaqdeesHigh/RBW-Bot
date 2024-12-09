const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { query } = require("../../database");
const errorHandler = require('../../handlers/errorHandler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("force_unregister")
    .setDescription("Force unregister a user or all users (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName("user")
        .setDescription("Unregister a specific user")
        .addUserOption(option =>
          option.setName("target")
            .setDescription("The user to unregister")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("all")
        .setDescription("Unregister all users (Warning: This cannot be undone)")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (interaction.options.getSubcommand() === "all") {
      await interaction.editReply({
        content: "⚠️ WARNING: This will unregister ALL users, delete their stats, and reset their nicknames. This action cannot be undone.\nPlease type 'CONFIRM' to proceed.",
        ephemeral: true
      });

      const filter = m => m.author.id === interaction.user.id && m.content.toUpperCase() === 'CONFIRM';
      const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async () => {
        try {
          // Get all registered users
          const registeredUsers = await query('registered', 'select', 'SELECT * FROM registered');
          let successCount = 0;
          let errorCount = 0;

          for (const user of registeredUsers) {
            try {
              // Delete from registered and stats collections
              await query('registered', 'deleteOne', { discord_id: user.discord_id });
              await query('stats', 'deleteOne', { discord_id: user.discord_id });

              // Reset nickname if possible
              try {
                const member = await interaction.guild.members.fetch(user.discord_id);
                if (member.guild.members.me.permissions.has('ManageNicknames') &&
                    member.manageable) {
                  await member.setNickname(null);
                }
                successCount++;
              } catch (nickError) {
                console.error(`Failed to reset nickname for user ${user.discord_id}:`, nickError);
                errorCount++;
              }
            } catch (userError) {
              console.error(`Failed to process user ${user.discord_id}:`, userError);
              errorCount++;
            }
          }

          await interaction.followUp({
            content: `Unregistration complete:\n✅ Successfully processed: ${successCount} users\n❌ Errors encountered: ${errorCount} users`,
            ephemeral: true
          });
        } catch (error) {
          console.error(error);
          await interaction.followUp({
            content: "An error occurred while unregistering all users.",
            ephemeral: true
          });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp({
            content: "Operation cancelled: No confirmation received within 30 seconds.",
            ephemeral: true
          });
        }
      });

    } else {
      const targetUser = interaction.options.getUser("target");
      try {
        const existingUser = await query('registered', 'findOne', { discord_id: targetUser.id });
        if (!existingUser) {
          return interaction.editReply({
            content: `${targetUser.username} is not registered.`,
            ephemeral: true,
          });
        }
        await query('registered', 'deleteOne', { discord_id: targetUser.id });
        await query('stats', 'deleteOne', { discord_id: targetUser.id });
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
    }
  },
};