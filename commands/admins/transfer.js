const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { query } = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Transfer commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("stats")
        .setDescription("Transfer stats from one user to another")
        .addUserOption(option => 
          option.setName("from")
            .setDescription("User to transfer stats from")
            .setRequired(true))
        .addUserOption(option => 
          option.setName("to")
            .setDescription("User to transfer stats to")
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName("user")
        .setDescription("Transfer complete user data from one user to another")
        .addUserOption(option => 
          option.setName("from")
            .setDescription("User to transfer from")
            .setRequired(true))
        .addUserOption(option => 
          option.setName("to")
            .setDescription("User to transfer to")
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const fromUser = interaction.options.getUser("from");
    const toUser = interaction.options.getUser("to");
    const subcommand = interaction.options.getSubcommand();

    try {
      // Check if source user exists in database
      const fromUserData = await query('registered', 'findOne', { discord_id: fromUser.id });
      
      if (!fromUserData) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Error')
              .setDescription('Source user is not registered.')
          ]
        });
      }

      if (subcommand === "stats") {
        // For stats transfer, both users need to be registered
        const toUserData = await query('registered', 'findOne', { discord_id: toUser.id });
        if (!toUserData) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('Target user is not registered.')
            ]
          });
        }

        // Get source user stats
        const fromStats = await query('stats', 'findOne', { discord_id: fromUser.id });
        
        // Transfer stats
        await query('stats', 'updateOne', 
          { discord_id: toUser.id },
          { $set: {
            elo: fromStats.elo,
            wins: fromStats.wins,
            lost: fromStats.lost,
            wlr: fromStats.wlr,
            rank: fromStats.rank,
            games: fromStats.games,
            mvp: fromStats.mvp,
            bed_breaker: fromStats.bed_breaker
          }}
        );

      } else if (subcommand === "user") {
        // For user transfer, only source user needs to be registered
        // First, get all source user data
        const fromStats = await query('stats', 'findOne', { discord_id: fromUser.id });
        
        // Delete any existing data for target user if they happen to be registered
        await query('registered', 'deleteOne', { discord_id: toUser.id });
        await query('stats', 'deleteOne', { discord_id: toUser.id });

        // Update registration data to new user
        await query('registered', 'updateOne',
          { discord_id: fromUser.id },
          { $set: {
            discord_id: toUser.id,
            discord_user: toUser.tag
          }}
        );

        // Update stats data to new user
        await query('stats', 'updateOne',
          { discord_id: fromUser.id },
          { $set: { discord_id: toUser.id }}
        );

        // Try to update nickname for target user
        const targetMember = await interaction.guild.members.fetch(toUser.id);
        if (targetMember.guild.members.me.permissions.has('ManageNicknames') &&
            targetMember.manageable) {
          try {
            await targetMember.setNickname(fromUserData.mc_user);
          } catch (error) {
            console.error("Failed to update nickname:", error);
          }
        }

        // Try to remove nickname from source user
        const sourceMember = await interaction.guild.members.fetch(fromUser.id);
        if (sourceMember.guild.members.me.permissions.has('ManageNicknames') &&
            sourceMember.manageable) {
          try {
            await sourceMember.setNickname(null);
          } catch (error) {
            console.error("Failed to remove source user nickname:", error);
          }
        }
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Success')
            .setDescription(`Successfully transferred ${subcommand} from ${fromUser.tag} to ${toUser.tag}`)
        ]
      });

    } catch (error) {
      console.error(error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription(`An error occurred while transferring ${subcommand}.`)
        ]
      });
    }
  }
};