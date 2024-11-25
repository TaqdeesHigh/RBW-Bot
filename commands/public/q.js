const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('q')
    .setDescription('Show queued players in the current game'),
  name: 'q', // Explicitly add name property
  async execute(interaction) {
    try {
      const channel = interaction.channel;
      const gameNumber = channel.name.split('-')[1];

      if (!gameNumber) {
        await interaction.reply({ content: "This command can only be used in a game channel.", ephemeral: true });
        return;
      }

      const gameData = await query('games', 'findOne', { game_number: gameNumber });

      if (!gameData) {
        await interaction.reply({ content: "No game found for this channel.", ephemeral: true });
        return;
      }

      const team1Members = JSON.parse(gameData.team1_members);
      const team2Members = JSON.parse(gameData.team2_members);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Game ${gameNumber} - Queued Players`)
        .addFields(
          { 
            name: 'Team 1', 
            value: await getMemberNames(team1Members, interaction.client), 
            inline: true 
          },
          { 
            name: 'Team 2', 
            value: await getMemberNames(team2Members, interaction.client), 
            inline: true 
          }
        )
        .setFooter({ text: `Gamemode: ${gameData.gamemode}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in q command:', error);
      await interaction.reply({ content: "An error occurred while fetching game players.", ephemeral: true });
    }
  }
};

async function getMemberNames(memberIds, client) {
  const names = await Promise.all(memberIds.map(async (id) => {
    try {
      const member = await client.users.fetch(id);
      return member.username;
    } catch {
      return 'Unknown User';
    }
  }));

  return names.length > 0 ? names.join('\n') : 'No players';
}