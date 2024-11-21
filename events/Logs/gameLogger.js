const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

class GameLogger {
  constructor(client) {
    this.client = client;
  }

  async logGameStart(gameData) {
    const { gameNumber, gamemode, teams, startTime } = gameData;
    const logChannel = this.client.channels.cache.get(config.logsChannel);
  
    if (!logChannel) return;
  
    const embed = new EmbedBuilder()
      .setColor('#2F3136')
      .setDescription(`
  **Game** \`#${gameNumber}\` **has started!**
  
  **Team 1**
  ${teams[0].map(member => `• ${member.user.username}`).join('\n')}
  
  **Team 2**
  ${teams[1].map(member => `• ${member.user.username}`).join('\n')}
  
  **${this.client.user.username}** • <t:${Math.floor(startTime.getTime() / 1000)}:F>
  `)
      .setFooter({ 
        text: `${gamemode.toUpperCase()} Match`, 
        iconURL: this.client.user.displayAvatarURL() 
      });
  
    await logChannel.send({ embeds: [embed] });
  }
}

module.exports = GameLogger;