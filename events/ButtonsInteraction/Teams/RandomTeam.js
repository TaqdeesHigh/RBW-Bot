const { EmbedBuilder } = require('discord.js');
module.exports = {
  async execute(textChannel, voiceChannel, gamemode) {
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
  }
};