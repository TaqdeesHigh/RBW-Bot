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
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Game ${gameNumber} - Players`)
        .setFooter({ text: `Gamemode: ${gameData.gamemode}` });

      if (gameData.status === 'picking') {
        // Get all players in the queue
        const queuedPlayers = [...team1Members, ...team2Members];
        
        // During picking phase, only show captain and picked players
        const team1Captain = team1Members[0];
        const team2Captain = team2Members[0];
        
        // Only show picked players (excluding captains) if they exist
        const team1Picked = team1Members.slice(1);
        const team2Picked = team2Members.slice(1);

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

        // Show picked players only if there are any
        if (team1Picked.length > 0 || team2Picked.length > 0) {
          embed.addFields(
            { 
              name: 'Team 1 Picked', 
              value: await getMemberNames(team1Picked, interaction.client) || 'None',
              inline: true 
            },
            { 
              name: 'Team 2 Picked', 
              value: await getMemberNames(team2Picked, interaction.client) || 'None',
              inline: true 
            },
            { name: '\u200B', value: '\u200B', inline: true }
          );
        }

        // Calculate remaining players (players who haven't been picked yet)
        const pickedPlayers = [...team1Members, ...team2Members];
        const remainingPlayers = queuedPlayers.filter(id => 
          !team1Members.includes(id) && !team2Members.includes(id)
        );

        if (remainingPlayers.length > 0) {
          embed.addFields({
            name: 'Remaining Players',
            value: await getMemberNames(remainingPlayers, interaction.client),
            inline: false
          });
        }
      } else {
        // Normal display for non-picking phase
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