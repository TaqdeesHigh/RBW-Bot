// events/warnings/warning.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
  sendUnregisteredWarning: async function(channel, unregisteredUsers) {
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Unregistered Players Detected')
      .setDescription('The following players need to register before the game can start:')
      .addFields(
        { name: 'Unregistered Players', value: unregisteredUsers.map(user => `<@${user.id}>`).join(', ') }
      )
      .setFooter({ text: 'Please use the /register command to register and join the game.' });

    await channel.send({ 
      content: `${unregisteredUsers.map(user => `<@${user.id}>`).join(' ')}`,
      embeds: [embed] 
    });
  }
};