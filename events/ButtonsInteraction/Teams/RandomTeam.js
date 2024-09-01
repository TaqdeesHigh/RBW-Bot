const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const GameLogger = require('../../Logs/gameLogger');

module.exports = {
  async execute(textChannel, voiceChannel, gamemode, client) {
    const gameLogger = new GameLogger(client);
    const gameNumber = textChannel.name.split('-')[1];
    const guild = textChannel.guild;

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

    // Create team channels
    const teamChannels = [];
    for (let i = 0; i < 2; i++) {
      const teamVoiceChannel = await guild.channels.create({
        name: `Team ${i + 1} - Game ${gameNumber}`,
        type: 2, // 2 is the channel type for voice channels
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
      selectionMethod: 'Random',
      teams,
      startTime: new Date()
    });

    // Delete the original voice channel
    await voiceChannel.delete();

    // Send the team information to the text channel
    await textChannel.send("Team channels have been created and members have been moved. Both teams can see and join each other's channels. Good luck and have fun!");
  }
};