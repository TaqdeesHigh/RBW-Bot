const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../database");
const config = require('../../config.json');

const cooldowns = new Map(); // Now stores server-wide cooldown instead of per-user
const COOLDOWN_TIME = 600000; // 10 minutes in milliseconds

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rbw")
    .setDescription("Ping RBW role to find players"),

  async execute(interaction) {
    try {
      const role = interaction.guild.roles.cache.get(config.rbwID);
      const serverId = interaction.guild.id;
      const rbwChannel = interaction.guild.channels.cache.get(config.rbwpingChannelID);

      if (!role) {
        return await interaction.reply({
          content: "The RBW role could not be found.",
          ephemeral: true
        });
      }

      if (!rbwChannel) {
        return await interaction.reply({
          content: "The RBW channel could not be found.",
          ephemeral: true
        });
      }

      const now = Date.now();
      const lastUsed = cooldowns.get(serverId);

      if (lastUsed && (now - lastUsed) < COOLDOWN_TIME) {
        const timeLeft = Math.ceil((COOLDOWN_TIME - (now - lastUsed)) / 60000);
        return await interaction.reply({
          content: `Please wait ${timeLeft} minutes before using this command again. Someone recently pinged for RBW.`,
          ephemeral: true
        });
      }

      cooldowns.set(serverId, now);

      // Create embed with user information
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('RBW Game Request')
        .setDescription(`${interaction.user} wants to play!`)
        .setTimestamp();

      // Check if user is in a voice channel
      const memberVoiceState = interaction.member.voice;
      if (memberVoiceState.channel) {
        embed.addFields(
          { name: 'Voice Channel', value: memberVoiceState.channel.name, inline: true },
          { name: 'Players in Channel', value: `${memberVoiceState.channel.members.size}`, inline: true }
        );
      } else {
        embed.addFields(
          { name: 'Status', value: 'Not in a voice channel', inline: true }
        );
      }

      // Create buttons for RBW notifications
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('rbw_on')
            .setLabel('Enable RBW Pings')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('rbw_off')
            .setLabel('Disable RBW Pings')
            .setStyle(ButtonStyle.Danger)
        );

      // Send the message to the RBW channel
      await rbwChannel.send({
        content: `<@&${config.rbwID}>`,
        embeds: [embed],
        components: [row],
        allowedMentions: { roles: [config.rbwID] }
      });

      // Reply to the user that the ping was sent
      return await interaction.reply({
        content: `RBW ping has been sent in ${rbwChannel}!`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in rbw command:', error);
      return await interaction.reply({
        content: "An error occurred while executing the command.",
        ephemeral: true
      });
    }
  },
};

// Cleanup cooldowns periodically
setInterval(() => {
  const now = Date.now();
  cooldowns.forEach((timestamp, serverId) => {
    if (now - timestamp > COOLDOWN_TIME) {
      cooldowns.delete(serverId);
    }
  });
}, COOLDOWN_TIME);