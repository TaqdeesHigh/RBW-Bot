const { MessageCollector, EmbedBuilder, PermissionsBitField } = require('discord.js');
const GameLogger = require('../Logs/gameLogger');
const { query } = require('../../database');

module.exports = {
  async execute(textChannel, voiceChannel, gamemode, client) {
    const gameLogger = new GameLogger(client);
    const gameNumber = textChannel.name.split('-')[1];
    const guild = textChannel.guild;
    const EMBED_COLOR = '#2F3136';

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

    // Randomly select two captains
    const captains = members.sort(() => 0.5 - Math.random()).slice(0, 2);
    teams[0].push(captains[0]);
    teams[1].push(captains[1]);

    const captainEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Team Captains Selected')
      .addFields(
        { name: 'Team 1 Captain', value: captains[0].user.username, inline: true },
        { name: 'Team 2 Captain', value: captains[1].user.username, inline: true }
      )
      .setTimestamp();

    await textChannel.send({ embeds: [captainEmbed] });

    const remainingMembers = members.filter(member => !captains.includes(member));

    // Define selection patterns based on gamemode
    const selectionPattern = teamSize === 3 ? [1, 2, 1] : [1, 2, 2, 1];
    let currentTeam = 0; // 0 for team 1, 1 for team 2
    let patternIndex = 0;

    while (remainingMembers.length > 0) {
      const selectionsNeeded = Math.min(selectionPattern[patternIndex], remainingMembers.length);
      
      // If this is the last remaining member(s), automatically assign them
      if (remainingMembers.length <= selectionsNeeded) {
        for (const member of remainingMembers) {
          teams[currentTeam].push(member);
          const autoAssignEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('Automatic Assignment')
            .setDescription(`${member.user.username} has been automatically assigned to Team ${currentTeam + 1}`)
            .setTimestamp();
          await textChannel.send({ embeds: [autoAssignEmbed] });
        }
        break;
      }

      const selectionEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`Team ${currentTeam + 1} Selection`)
        .setDescription(`${captains[currentTeam].user}, select ${selectionsNeeded} player${selectionsNeeded > 1 ? 's' : ''} by mentioning them.`)
        .addFields({
          name: 'Available Players',
          value: remainingMembers.map(member => member.user.username).join('\n')
        })
        .setTimestamp();

      await textChannel.send({ embeds: [selectionEmbed] });

      let selectedCount = 0;
      while (selectedCount < selectionsNeeded) {
        const filter = m => m.author.id === captains[currentTeam].id && m.mentions.members.size > 0;
        const collector = new MessageCollector(textChannel, { filter, max: 1, time: 30000 });

        const collected = await new Promise(resolve => {
          collector.on('end', collected => resolve(collected));
        });

        if (collected.size === 0) {
          // Timeout - randomly select remaining required players
          const remainingSelection = selectionsNeeded - selectedCount;
          for (let i = 0; i < remainingSelection; i++) {
            const randomIndex = Math.floor(Math.random() * remainingMembers.length);
            const randomMember = remainingMembers[randomIndex];
            teams[currentTeam].push(randomMember);
            remainingMembers.splice(randomIndex, 1);
            selectedCount++;

            const timeoutEmbed = new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setTitle('Selection Timeout')
              .setDescription(`No selection made. Randomly added ${randomMember.user.username} to Team ${currentTeam + 1}.`)
              .setTimestamp();

            await textChannel.send({ embeds: [timeoutEmbed] });
          }
        } else {
          const message = collected.first();
          const selectedMember = message.mentions.members.first();

          if (remainingMembers.includes(selectedMember)) {
            teams[currentTeam].push(selectedMember);
            remainingMembers.splice(remainingMembers.indexOf(selectedMember), 1);
            selectedCount++;
            await textChannel.send(`Added ${selectedMember.user.username} to Team ${currentTeam + 1}.`);
          } else {
            await textChannel.send(`Invalid selection. Please choose from the remaining players.`);
          }
        }
      }

      currentTeam = (currentTeam + 1) % 2;
      if (currentTeam === 0) patternIndex++;
    }

    const finalEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Final Team Assignments')
      .setTimestamp();

    teams.forEach((team, index) => {
      finalEmbed.addFields({
        name: `Team ${index + 1}`,
        value: team.map(member => member.user.username).join('\n'),
        inline: true
      });
    });

    await textChannel.send({ embeds: [finalEmbed] });

    // Create team channels
    const teamChannels = [];
    for (let i = 0; i < 2; i++) {
      const teamVoiceChannel = await guild.channels.create({
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
      teamChannels.push(teamVoiceChannel);
    }

    // Move team members to their respective voice channels
    for (let i = 0; i < 2; i++) {
      for (const member of teams[i]) {
        await member.voice.setChannel(teamChannels[i]).catch(console.error);
      }
    }

    await gameLogger.logGameStart({
      gameNumber,
      gamemode,
      selectionMethod: 'Captain Pick',
      teams,
      startTime: new Date()
    });

    // Delete the original voice channel
    await voiceChannel.delete();

    // Send the team information to the text channel
    await textChannel.send("Team channels have been created and members have been moved. Both teams can see and join each other's channels. Good luck and have fun!");
  }
};