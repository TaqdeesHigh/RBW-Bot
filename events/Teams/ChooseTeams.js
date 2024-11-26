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
      if (!voiceChannel || !voiceChannel.members) {
        await textChannel.send("Error: Voice channel not found or has no members.");
        return;
      }

      const members = Array.from(voiceChannel.members.values());
      if (members.length === 0) {
        await textChannel.send("Error: No members found in the voice channel.");
        return;
      }

      const teamSize = parseInt(gamemode.charAt(0));
      const teams = [[], []];

      // Select captains randomly with validation
      const validMembers = members.filter(member => member?.user);
      if (validMembers.length < 2) {
        await textChannel.send("Error: Not enough valid members for team selection.");
        return;
      }

      const captains = validMembers.sort(() => 0.5 - Math.random()).slice(0, 2);
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

      let remainingMembers = members.filter(member => !captains.includes(member));

      // Define picking pattern based on gamemode
      const pickingOrder = gamemode === '3v3' ? 
        [[0, 1], [1, 2], [0, 1]] :  // 3v3 pattern
        [[0, 1], [1, 2], [0, 2], [1, 1]];  // 4v4 pattern

      for (const [orderIndex, [teamNumber, pickCount]] of pickingOrder.entries()) {
        const currentCaptain = captains[teamNumber];
        
        // Auto-assign last player if only one remains
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
        const selectionTimeout = 30000; // 30 seconds

        while (selectedCount < pickCount && remainingMembers.length > 0) {
          try {
            const collected = await textChannel.awaitMessages({
              filter: m => {
                // Strict captain validation
                if (m.author.id !== currentCaptain.id) return false;
                
                const content = m.content.toLowerCase();
                const hasPickCommand = content.startsWith('pick ') || content.startsWith('p ');
                
                if (!hasPickCommand || !m.mentions.members.size === 1) return false;
                
                const mentionedMember = m.mentions.members.first();
                
                // Prevent picking from other team
                if (teams[teamNumber === 0 ? 1 : 0].some(member => member.id === mentionedMember.id)) return false;
                
                return remainingMembers.some(rm => rm.id === mentionedMember.id);
              },
              max: 1,
              time: selectionTimeout,
              errors: ['time']
            });

            const message = collected.first();
            const selectedMember = message.mentions.members.first();

            if (remainingMembers.includes(selectedMember)) {
              teams[teamNumber].push(selectedMember);
              remainingMembers = remainingMembers.filter(m => m.id !== selectedMember.id);
              selectedCount++;
              
              await message.react('✅');
              await textChannel.send(`${selectedMember.user.username} added to Team ${teamNumber + 1} (Pick ${selectedCount}/${pickCount})`);
            }
          } catch (error) {
            // Random selection on timeout
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

      // Create team channels with error handling
      const teamChannels = await Promise.all([0, 1].map(async (i) => {
        try {
          return await guild.channels.create({
            name: `Team ${i + 1} - Game ${gameNumber}`,
            type: 2,
            parent: voiceChannel.parent,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              ...members.map(member => ({
                id: member.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
              })),
            ],
          });
        } catch (error) {
          console.error(`Failed to create team channel ${i + 1}:`, error);
          throw error;
        }
      }));

      // Move members to their channels with error handling
      await Promise.all(teams.map(async (team, index) => {
        return Promise.all(team.map(async (member) => {
          try {
            if (member?.voice?.setChannel) {
              await member.voice.setChannel(teamChannels[index]);
            }
          } catch (error) {
            console.error(`Failed to move ${member.user?.username || 'unknown member'}:`, error);
          }
        }));
      }));

      // Log game start
      await gameLogger.logGameStart({
        gameNumber,
        gamemode,
        selectionMethod: 'Captain Pick',
        teams,
        startTime: new Date()
      });

      // Delete original channel
      try {
        await voiceChannel.delete();
      } catch (error) {
        console.error('Failed to delete original voice channel:', error);
      }

      // Update game status in database
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
            value: team.map(member => member.user?.username || 'Unknown Player').join('\n'),
            inline: true
          }))
        )
        .setTimestamp();

      await textChannel.send({ embeds: [finalEmbed] });
      await textChannel.send("Team channels have been created and members have been moved.");

    } catch (error) {
      console.error('Error in captain pick execution:', error);
      await textChannel.send("An error occurred during team selection. Please contact an administrator.");
    }
  }
};