const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

class GameLogger {
  constructor(client) {
    this.client = client;
  }

  async logGameStart(gameData) {
    const { gameNumber, gamemode, selectionMethod, teams, startTime, spectators } = gameData;
    const logChannel = this.client.channels.cache.get(config.logsChannel);

    if (!logChannel) {
      console.error('Game log channel not found. Check your config.json file.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle(`🎮 Game #${gameNumber} - ${gamemode.toUpperCase()} Match`)
      .setDescription(`A new ${gamemode} match has started!`)
      .setTimestamp()
      .setFooter({ text: `Match logged by ${this.client.user.username}`, iconURL: this.client.user.displayAvatarURL() });

    embed.addFields(
      { name: '🕒 Start Time', value: `\`${startTime.toLocaleString()}\``, inline: true },
      { name: '🔀 Selection Method', value: `\`${selectionMethod}\``, inline: true },
      { name: '👥 Players', value: `\`${teams.reduce((acc, team) => acc + team.length, 0)} (${gamemode})\``, inline: true }
    );

    teams.forEach((team, index) => {
      const teamMembers = team.map(member => `• ${member.user.username}`).join('\n');
      embed.addFields({ name: `🏆 Team ${index + 1}`, value: teamMembers, inline: true });
    });

    /*if (spectators && spectators.length > 0) {
      const spectatorList = spectators.map(s => `• ${s.username}`).join('\n');
      embed.addFields({ name: '👀 Spectators', value: spectatorList, inline: false });
    } should i add this?*/

    await logChannel.send({ embeds: [embed] });
  }
}

module.exports = GameLogger;