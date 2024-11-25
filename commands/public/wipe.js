const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wipe")
    .setDescription("Wipe your stats (This will reset all your statistics)"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.user;

    try {
      // Check if user exists in database
      const existingUser = await query('registered', 'findOne', { discord_id: user.id });
      
      if (!existingUser) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('Error')
              .setDescription('You are not registered.')
          ]
        });
      }

      // Create confirmation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_wipe')
            .setLabel('Confirm Wipe')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_wipe')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      const warningEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('⚠️ Wipe Warning')
        .setDescription('Are you sure you want to wipe your stats? This will reset:\n\n' +
          '• Your ELO\n' +
          '• Wins/Losses\n' +
          '• Win/Loss Ratio\n' +
          '• Games Played\n' +
          '• MVP Count\n' +
          '• Bed Breaker Count\n\n' +
          '**This action cannot be undone!**');

      const response = await interaction.editReply({
        embeds: [warningEmbed],
        components: [row],
        ephemeral: true,
      });

      // Create button collector
      const collector = response.createMessageComponentCollector({ 
        filter: i => i.user.id === user.id,
        time: 30000,
        max: 1 
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'confirm_wipe') {
          // Reset stats
          await query('stats', 'updateOne', 
            { discord_id: user.id },
            { $set: {
              elo: 0,
              wins: 0,
              lost: 0,
              wlr: 0,
              rank: 'Unranked',
              games: 0,
              mvp: 0,
              bed_breaker: 0
            }}
          );

          const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Stats Wiped')
            .setDescription('Your stats have been successfully reset to zero.');

          await i.update({
            embeds: [successEmbed],
            components: [],
          });
        } else {
          const cancelEmbed = new EmbedBuilder()
            .setColor('#0000FF')
            .setTitle('Wipe Cancelled')
            .setDescription('Your stats will remain unchanged.');

          await i.update({
            embeds: [cancelEmbed],
            components: [],
          });
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle('Wipe Timed Out')
            .setDescription('You didn\'t respond in time. Your stats remain unchanged.');

          interaction.editReply({
            embeds: [timeoutEmbed],
            components: [],
          });
        }
      });

    } catch (error) {
      console.error(error);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('An error occurred while wiping your stats.')
        ]
      });
    }
  }
};