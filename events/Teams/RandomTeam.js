const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const GameLogger = require('../Logs/gameLogger');
const { query } = require('../../database');

module.exports = {
  async execute(textChannel, voiceChannel, gamemode, client) {
    const gameLogger = new GameLogger(client);
    const gameNumber = textChannel.name.split('-')[1];
    const guild = textChannel.guild;
    const EMBED_COLOR = '#2F3136';
  
    try {
      // Get the game data to access all members
      const gameData = await query('games', 'findOne', { game_number: gameNumber });
      if (!gameData) {
        await textChannel.send("Error: Game data not found.");
        return;
      }
  
      // Combine members from both teams to get all original members
      const allMemberIds = [
        ...JSON.parse(gameData.team1_members),
        ...JSON.parse(gameData.team2_members)
      ];
  
      const originalMembers = await Promise.all(
        allMemberIds.map(async id => {
          return await guild.members.fetch(id).catch(() => null);
        })
      );
  
      const validMembers = originalMembers.filter(member => member !== null);
      
      if (validMembers.length === 0) {
        await textChannel.send("Error: No valid members found.");
        return;
      }
  
      const teams = [[], []];
      
      // Shuffle and assign teams
      const shuffledMembers = [...validMembers].sort(() => 0.5 - Math.random());
      for (let i = 0; i < shuffledMembers.length; i++) {
        teams[i % 2].push(shuffledMembers[i]);
      }
  
      // Create team channels and move members
      const teamChannels = await Promise.all([0, 1].map(async (i) => {
        return await guild.channels.create({
          name: `Team ${i + 1} - Game ${gameNumber}`,
          type: 2,
          parent: voiceChannel.parent,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            ...validMembers.map(member => ({
              id: member.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
            })),
          ],
        });
      }));
  
      // Move members who are in voice channels
      for (let i = 0; i < 2; i++) {
        for (const member of teams[i]) {
          try {
            if (member.voice?.channel) {
              await member.voice.setChannel(teamChannels[i]);
            }
          } catch (error) {
            console.log(`Note: Couldn't move ${member.user.tag} to team channel - they may have left voice`);
          }
        }
      }
  
      // Continue with game logging and cleanup
      await gameLogger.logGameStart({
        gameNumber,
        gamemode,
        selectionMethod: 'Random',
        teams,
        startTime: new Date()
      });
  
      try {
        await voiceChannel.delete();
      } catch (error) {
        console.error('Error deleting voice channel:', error);
      }
  
      await query('games', 'updateOne', 
        { game_number: gameNumber }, 
        { $set: { 
          status: 'in_progress', 
          team1_members: JSON.stringify(teams[0].map(m => m.id)),
          team2_members: JSON.stringify(teams[1].map(m => m.id))
        }}
      );
  
      // Send final team assignments
      const finalEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('Final Team Assignments')
        .addFields(
          teams.map((team, index) => ({
            name: `Team ${index + 1}`,
            value: team.map(member => member.user.username).join('\n'),
            inline: true
          }))
        )
        .setTimestamp();
  
      await textChannel.send({ embeds: [finalEmbed] });
    } catch (error) {
      console.error('Error in random team selection:', error);
      await textChannel.send("An error occurred during team selection. Please contact an administrator.");
    }
  }
};