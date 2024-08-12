const fs = require('fs');
const path = require('path');
const playerManager = require('../utils/playerManager');

const commands = new Map();
const commandsPath = path.join(__dirname, '..', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  commands.set(command.data.name, command);
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (interaction.commandName !== 'register' && !playerManager.getPlayer(interaction.user.id)) {
        await interaction.reply('You need to register first. Use /register to sign up.');
        return;
      }
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
  },
};