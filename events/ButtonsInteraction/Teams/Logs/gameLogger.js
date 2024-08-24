// gameLogger.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'gameStart',
  async execute(client, gameData) {
    const { 
      gameNumber, 
      gamemode, 
      selectionMethod, 
      teams, 
      startTime 
    } = gameData;

    const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
    if (!logsChannel) {
      console.error('Logs channel not found');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Game ${gameNumber} Started`)
      .setDescription(`A new game has started in ${gamemode} mode`)
      .addFields(
        { name: 'Selection Method', value: selectionMethod, inline: true },
        { name: 'Start Time', value: startTime.toUTCString(), inline: true },
        { name: 'Team 1', value: teams[0].map(member => member.user.username).join('\n'), inline: true },
        { name: 'Team 2', value: teams[1].map(member => member.user.username).join('\n'), inline: true }
      )
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  }
};