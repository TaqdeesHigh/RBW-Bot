const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { query } = require("../../database");

const cooldowns = new Map();
const COOLDOWN_TIME = 3600000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rbw")
    .setDescription("Ping RBW role or manage your RBW ping settings")
    .addStringOption(option =>
      option
        .setName("setting")
        .setDescription("Toggle your RBW ping notifications")
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' }
        )
    ),

  async execute(interaction) {
    try {
      const setting = interaction.options.getString("setting");
      const roleId = '1312797707815096360';
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return await interaction.reply({
          content: "The RBW role could not be found.",
          ephemeral: true
        });
      }

      if (!setting) {
        const userId = interaction.user.id;
        const now = Date.now();
        const lastUsed = cooldowns.get(userId);

        if (lastUsed && (now - lastUsed) < COOLDOWN_TIME) {
          const timeLeft = Math.ceil((COOLDOWN_TIME - (now - lastUsed)) / 60000);
          return await interaction.reply({
            content: `You need to wait ${timeLeft} minutes before using this command again.`,
            ephemeral: true
          });
        }

        cooldowns.set(userId, now);

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

        // Send both the ping and the embed
        return await interaction.reply({
          content: `<@&${roleId}>`,
          embeds: [embed],
          allowedMentions: { roles: [roleId] }
        });
      }

      // Rest of the code remains the same
      const registeredUser = await query('registered', 'findOne', { discord_id: interaction.user.id });
      if (!registeredUser) {
        return await interaction.reply({
          content: "You need to be registered to manage your RBW ping settings.",
          ephemeral: true
        });
      }

      const hasRole = interaction.member.roles.cache.has(roleId);

      if (setting === 'on') {
        if (hasRole) {
          return await interaction.reply({
            content: "You already have RBW ping notifications enabled.",
            ephemeral: true
          });
        }
        await interaction.member.roles.add(role);
        return await interaction.reply({
          content: "You will now receive RBW ping notifications.",
          ephemeral: true
        });
      } else if (setting === 'off') {
        if (!hasRole) {
          return await interaction.reply({
            content: "You already have RBW ping notifications disabled.",
            ephemeral: true
          });
        }
        await interaction.member.roles.remove(role);
        return await interaction.reply({
          content: "You will no longer receive RBW ping notifications.",
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error in rbw command:', error);
      return await interaction.reply({
        content: "An error occurred while executing the command.",
        ephemeral: true
      });
    }
  },
};

setInterval(() => {
  const now = Date.now();
  cooldowns.forEach((timestamp, userId) => {
    if (now - timestamp > COOLDOWN_TIME) {
      cooldowns.delete(userId);
    }
  });
}, COOLDOWN_TIME);