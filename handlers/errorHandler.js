const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');

class ErrorHandler {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.currentLogFile = null;
  }

  async initializeLogFile() {
    await fs.mkdir(this.logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    this.currentLogFile = path.join(this.logDir, `error_log_${timestamp}.txt`);
  }

  async logError(error, context = {}) {
    if (!this.currentLogFile) {
      await this.initializeLogFile();
    }

    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${error.stack}\nContext: ${JSON.stringify(context)}\n\n`;

    console.error(errorMessage);

    try {
      await fs.appendFile(this.currentLogFile, errorMessage);
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }
  }

  async handleCommandError(interaction, error) {
    const context = {
      command: interaction.commandName,
      user: interaction.user.tag,
      guild: interaction.guild ? interaction.guild.name : 'DM',
    };

    await this.logError(error, context);

    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Error')
      .setDescription('An error occurred while executing the command.')
      .addFields(
        { name: 'Command', value: interaction.commandName },
        { name: 'Error Message', value: error.message }
      )
      .setTimestamp();

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
    }
  }
}

module.exports = new ErrorHandler();