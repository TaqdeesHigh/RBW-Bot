const { MessageCollector, EmbedBuilder, PermissionsBitField } = require('discord.js');
const GameLogger = require('../Logs/gameLogger');
const { query } = require('../../database');

module.exports = {
  async execute(textChannel, voiceChannel, gamemode, client) {
    const gameLogger = new GameLogger(client);
    const gameNumber = textChannel.name.split('-')[1];
    const guild = textChannel.guild;
    const EMBED_COLOR = '#2F3136';

      try {

        const channel = await client.channels.fetch(textChannel.id)
            .catch(() => null);
        
        if (!channel) {
            return;
        }

        // Get game data to access original members
        const gameData = await query('games', 'findOne', { game_number: gameNumber });
        if (!gameData) {
          await textChannel.send("Error: Game data not found.");
          return;
        }

        // Get all original members from both teams
        const allMemberIds = [
          ...JSON.parse(gameData.team1_members),
          ...JSON.parse(gameData.team2_members)
        ];

        // Fetch all original members
        const originalMembers = await Promise.all(
          allMemberIds.map(async id => {
            return await guild.members.fetch(id).catch(() => null);
          })
        );

        const validMembers = originalMembers.filter(member => member !== null);
        
        if (validMembers.length < 2) {
          await textChannel.send("Error: Not enough valid members for team selection.");
          return;
        }

        const teamSize = parseInt(gamemode.charAt(0));
        const teams = [[], []];

        // Select captains randomly
        const captains = validMembers
          .sort(() => 0.5 - Math.random())
          .slice(0, 2);

        teams[0].push(captains[0]);
        teams[1].push(captains[1]);

        const captainsEmbed = new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle('Team Captains Selected')
          .addFields(
            { name: 'Team 1 Captain', value: captains[0].user.username, inline: true },
            { name: 'Team 2 Captain', value: captains[1].user.username, inline: true }
          )
          .setTimestamp();

        await textChannel.send({ embeds: [captainsEmbed] });

        // Filter out captains from available members
        let remainingMembers = validMembers.filter(member => 
          !captains.some(captain => captain.id === member.id)
        );

        const pickingOrder = gamemode === '3v3' ? 
          [[0, 1], [1, 2], [0, 1]] : 
          [[0, 1], [1, 2], [0, 2], [1, 1]];

        for (const [orderIndex, [teamNumber, pickCount]] of pickingOrder.entries()) {
          const currentCaptain = captains[teamNumber];
          
          if (remainingMembers.length === 1 && orderIndex === pickingOrder.length - 1) {
            const lastPlayer = remainingMembers[0];
            teams[teamNumber].push(lastPlayer);
            remainingMembers = [];
            await textChannel.send(`${lastPlayer.user.username} has been automatically assigned to Team ${teamNumber + 1}`);
            continue;
          }

          const selectionEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`Team ${teamNumber + 1} Selection`)
            .setDescription(`${currentCaptain.user.username}, select ${pickCount} player${pickCount > 1 ? 's' : ''}\nType "pick @player" or "p @player"`)
            .addFields({
              name: 'Available Players',
              value: remainingMembers.map(member => `${member.user.username} (<@${member.id}>)`).join('\n') || 'No players available'
            })
            .setTimestamp();

          await textChannel.send({ embeds: [selectionEmbed] });

          let selectedCount = 0;
          const selectionTimeout = 180000;

          while (selectedCount < pickCount && remainingMembers.length > 0) {
            try {
              const collected = await textChannel.awaitMessages({
                filter: m => {
                  if (m.author.id !== currentCaptain.id) return false;
                  
                  const content = m.content.toLowerCase();
                  const hasPickCommand = content.startsWith('pick ') || content.startsWith('p ');
                  
                  if (!hasPickCommand || !m.mentions.members.size === 1) return false;
                  
                  const mentionedMember = m.mentions.members.first();
                  
                  return remainingMembers.some(m => m.id === mentionedMember.id);
                },
                max: 1,
                time: selectionTimeout,
                errors: ['time']
              });

              const message = collected.first();
              const selectedMember = message.mentions.members.first();

              if (remainingMembers.some(m => m.id === selectedMember.id)) {
                teams[teamNumber].push(selectedMember);
                remainingMembers = remainingMembers.filter(m => m.id !== selectedMember.id);
                selectedCount++;
                
                await message.react('✅');
                await textChannel.send(`${selectedMember.user.username} added to Team ${teamNumber + 1} (Pick ${selectedCount}/${pickCount})`);
              }
            } catch (error) {
              if (remainingMembers.length > 0) {
                const randomIndex = Math.floor(Math.random() * remainingMembers.length);
                const randomMember = remainingMembers[randomIndex];
                teams[teamNumber].push(randomMember);
                remainingMembers = remainingMembers.filter(m => m.id !== randomMember.id);
                selectedCount++;

                await textChannel.send(`⏰ Time's up! Randomly added ${randomMember.user.username} to Team ${teamNumber + 1}`);
              }
            }
          }
        }

        const teamChannels = await Promise.all([0, 1].map(async (i) => {
          return await guild.channels.create({
            name: `Team ${i + 1} - Game ${gameNumber}`,
            type: 2,
            parent: voiceChannel.parent,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                allow: [PermissionsBitField.Flags.ViewChannel],
                deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
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

        await gameLogger.logGameStart({
          gameNumber,
          gamemode,
          selectionMethod: 'Captain Pick',
          teams,
          startTime: new Date()
        });

        try {
          await voiceChannel.delete();
        } catch (error) {
          console.error('Failed to delete original voice channel:', error);
        }

        await query('games', 'updateOne', 
          { game_number: gameNumber }, 
          { $set: { 
            status: 'in_progress', 
            team1_members: JSON.stringify(teams[0].map(m => m.id)),
            team2_members: JSON.stringify(teams[1].map(m => m.id))
          }}
        );

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
      console.error('Error in captain pick execution:', error);
      await textChannel.send("An error occurred during team selection. Please contact an administrator.");
    }
  }

};