const { MessageCollector, EmbedBuilder, PermissionsBitField } = require('discord.js');
const GameLogger = require('../../Logs/gameLogger');

module.exports = {
  async execute(textChannel, voiceChannel, gamemode, client) {
    const gameLogger = new GameLogger(client);
    const gameNumber = textChannel.name.split('-')[1];

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
      .setColor('#FFA500')
      .setTitle('👑 Team Captains Selected')
      .addFields(
        { name: 'Team 1 Captain', value: captains[0].user.username, inline: true },
        { name: 'Team 2 Captain', value: captains[1].user.username, inline: true }
      )
      .setTimestamp();

    await textChannel.send({ embeds: [captainEmbed] });

    const remainingMembers = members.filter(member => !captains.includes(member));

    for (let i = 0; i < teamSize - 1; i++) {
      for (let j = 0; j < 2; j++) {
        if (remainingMembers.length === 0) break;

        const selectionEmbed = new EmbedBuilder()
          .setColor('#1E90FF')
          .setTitle(`Team ${j + 1} Selection`)
          .setDescription(`${captains[j].user}, choose a player for your team by mentioning them.`)
          .addFields({
            name: 'Available Players',
            value: remainingMembers.map(member => member.user.username).join('\n')
          })
          .setTimestamp();

        await textChannel.send({ embeds: [selectionEmbed] });

        const filter = m => m.author.id === captains[j].id && m.mentions.members.size > 0;
        const collector = new MessageCollector(textChannel, { filter, max: 1, time: 30000 });

        const collected = await new Promise(resolve => {
          collector.on('end', collected => resolve(collected));
        });

        if (collected.size === 0) {
          const randomMember = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];
          teams[j].push(randomMember);
          remainingMembers.splice(remainingMembers.indexOf(randomMember), 1);

          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Selection Timeout')
            .setDescription(`No selection made. Randomly added ${randomMember.user.username} to Team ${j + 1}.`)
            .setTimestamp();

          await textChannel.send({ embeds: [timeoutEmbed] });
        } else {
          const selectedMember = collected.first().mentions.members.first();
          if (remainingMembers.includes(selectedMember)) {
            teams[j].push(selectedMember);
            remainingMembers.splice(remainingMembers.indexOf(selectedMember), 1);
            await textChannel.send(`Added ${selectedMember.user.username} to Team ${j + 1}.`);
          } else {
            await textChannel.send(`Invalid selection. Please choose from the remaining players.`);
            j--; // Retry this captain's turn
          }
        }
      }
    }

    const finalEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🏆 Final Team Assignments')
      .setTimestamp();

    teams.forEach((team, index) => {
      finalEmbed.addFields({
        name: `Team ${index + 1}`,
        value: team.map(member => member.user.username).join('\n'),
        inline: true
      });
    });

    await textChannel.send({ embeds: [finalEmbed] });

    // Get the user who started the game (assuming they're the first member in the voice channel)
    const gameStarter = members[0];

    // Create new category and team channels
    const guild = textChannel.guild;
    const gameStartedCategory = await guild.channels.create({
      name: 'Game-Started',
      type: 4, // 4 is the channel type for categories
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: gameStarter.id,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    const allParticipants = teams.flat();

    const teamChannels = await Promise.all(teams.map((team, index) => 
      guild.channels.create({
        name: `team-${index + 1}`,
        type: 2,
        parent: gameStartedCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          ...allParticipants.map(member => ({
            id: member.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
            deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
          })),
          ...team.map(member => ({
            id: member.id,
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
          })),
        ],
      })
    ));

    // Move players to their respective team channels
    for (let i = 0; i < teams.length; i++) {
      for (const member of teams[i]) {
        await member.voice.setChannel(teamChannels[i]);
      }
    }

    await gameLogger.logGameStart({
      gameNumber,
      gamemode,
      selectionMethod: 'Captain Pick',
      teams,
      startTime: new Date()
    });

    // Delete the old channels
    await textChannel.delete();
    await voiceChannel.delete();
  }
};