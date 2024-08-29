const { EmbedBuilder, PermissionsBitField } = require('discord.js');
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

    // Shuffle the members array
    for (let i = members.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [members[i], members[j]] = [members[j], members[i]];
    }

    // Assign members to teams
    for (let i = 0; i < members.length; i++) {
      teams[i % 2].push(members[i]);
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🏆 Random Team Selection Results')
      .setTimestamp();

    teams.forEach((team, index) => {
      embed.addFields({
        name: `Team ${index + 1}`,
        value: team.map(member => member.user.username).join('\n'),
        inline: true
      });
    });

    await textChannel.send({ embeds: [embed] });

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
      selectionMethod: 'Random',
      teams,
      startTime: new Date()
    });

    // Delete the old channels
    await textChannel.delete();
    await voiceChannel.delete();
  }
};