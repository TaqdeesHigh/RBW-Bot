const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { query } = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("target")
    .setDescription("Admin commands for targeting specific groups")
    .addSubcommand(subcommand =>
      subcommand
        .setName("rbw")
        .setDescription("RBW ping settings")
        .addStringOption(option =>
          option
            .setName("ping")
            .setDescription("Toggle RBW ping role for all registered players")
            .setRequired(true)
            .addChoices(
              { name: 'On', value: 'on' },
              { name: 'Off', value: 'off' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
          content: "You don't have permission to use this command.",
          ephemeral: true
        });
      }

      const pingOption = interaction.options.getString("ping");
      const roleId = '1312797707815096360';
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return await interaction.reply({
          content: "The RBW ping role could not be found.",
          ephemeral: true
        });
      }

      await interaction.deferReply();

      // Fixed query to get all registered players
      const sql = "SELECT * FROM registered";
      const registeredPlayers = await query(null, 'raw', sql);

      let successCount = 0;
      let failCount = 0;

      for (const player of registeredPlayers) {
        try {
          const member = await interaction.guild.members.fetch(player.discord_id);
          
          if (pingOption === 'on' && !member.roles.cache.has(roleId)) {
            await member.roles.add(role);
            successCount++;
          } else if (pingOption === 'off' && member.roles.cache.has(roleId)) {
            await member.roles.remove(role);
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to update role for user ${player.discord_id}:`, error);
          failCount++;
        }
      }

      const action = pingOption === 'on' ? 'added to' : 'removed from';
      const response = `RBW ping role ${action} ${successCount} players.\n` +
                      (failCount > 0 ? `Failed for ${failCount} players.` : '');

      await interaction.editReply(response);

    } catch (error) {
      console.error('Error in target command:', error);
      const errorMessage = interaction.deferred ? 
        await interaction.editReply("An error occurred while executing the command.") :
        await interaction.reply({ content: "An error occurred while executing the command.", ephemeral: true });
    }
  },
};