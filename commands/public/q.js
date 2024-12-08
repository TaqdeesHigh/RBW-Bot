const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('q')
    .setDescription('Show queued players in the current game'),
  name: 'q',
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
      const allPlayers = [...team1Members, ...team2Members];
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Game ${gameNumber} - Players`)
        .setFooter({ text: `Gamemode: ${gameData.gamemode}` });

      // Handle different game states
      if (gameData.status === 'queued') {
        // During voting phase
        embed.addFields({
          name: 'Queued Players',
          value: await getMemberNames(allPlayers, interaction.client),
          inline: false
        })
        .setDescription('Voting in progress...');
      } 
      else if (gameData.status === 'in_progress') {
        // When teams are finalized
        embed.addFields(
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
        );
      }
      else {
        // During picking phase
        const team1Captain = team1Members[0];
        const team2Captain = team2Members[0];
        
        // Show captains
        if (team1Captain || team2Captain) {
          embed.addFields(
            { 
              name: 'Team 1 Captain', 
              value: await getMemberNames([team1Captain], interaction.client),
              inline: true 
            },
            { 
              name: 'Team 2 Captain', 
              value: await getMemberNames([team2Captain], interaction.client),
              inline: true 
            },
            { name: '\u200B', value: '\u200B', inline: true }
          );
        }

        // Show picked players (excluding captains)
        const team1Picked = team1Members.slice(1);
        const team2Picked = team2Members.slice(1);

        if (team1Picked.length > 0 || team2Picked.length > 0) {
          embed.addFields(
            { 
              name: 'Team 1 Players', 
              value: await getMemberNames(team1Picked, interaction.client) || 'None',
              inline: true 
            },
            { 
              name: 'Team 2 Players', 
              value: await getMemberNames(team2Picked, interaction.client) || 'None',
              inline: true 
            },
            { name: '\u200B', value: '\u200B', inline: true }
          );
        }

        // Show remaining players to be picked
        const pickedPlayers = [...team1Members, ...team2Members];
        const remainingPlayers = allPlayers.filter(id => 
          !pickedPlayers.includes(id)
        );

        if (remainingPlayers.length > 0) {
          embed.addFields({
            name: 'Available Players',
            value: await getMemberNames(remainingPlayers, interaction.client),
            inline: false
          });
        }
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in q command:', error);
      await interaction.reply({ content: "An error occurred while fetching game players.", ephemeral: true });
    }
  }
};

async function getMemberNames(memberIds, client) {
  if (!memberIds || memberIds.length === 0) return 'None';
  
  const names = await Promise.all(memberIds.map(async (id) => {
    try {
      const member = await client.users.fetch(id);
      return member.username;
    } catch {
      return 'Unknown User';
    }
  }));

  return names.join('\n');
}