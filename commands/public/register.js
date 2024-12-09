const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');
const { query } = require("../../database");
const config = require('../../config.json');

function getRankForElo(elo) {
    const thresholds = Object.keys(config.ranks).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
        if (elo >= threshold) {
            return config.ranks[threshold];
        }
    }
    return config.ranks[0];
}

function createEmbed(title, description, color = config.ThemeColor) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register command")
    .addStringOption((option) =>
      option.setName("name").setDescription("Your name").setRequired(true)
    ),

  async execute(interaction) {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply();

    if (interaction.channelId !== config.registerChannelID) {
      const embed = createEmbed(
        'Wrong Channel',
        'Please use this command in the registration channel.',
        '#FF0000'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const name = interaction.options.getString("name");

    try {
      // Check if player exists
      try {
        const playerResponse = await axios.get(`https://api.ngmc.co/v1/players/${name}`);
        if (playerResponse.data.banned === true) {
          const embed = createEmbed('Registration Failed', 'You are banned from the server.', '#FF0000');
          return await interaction.editReply({ embeds: [embed] });
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          const embed = createEmbed(
            'Registration Failed', 
            'This player does not exist.', 
            '#FF0000'
          );
          return await interaction.editReply({ embeds: [embed] });
        }
        throw error;
      }

      // Check if user is already registered
      const discorduser = await query('registered', 'findOne', { discord_id: interaction.user.id });
      if (discorduser) {
        const embed = createEmbed('Registration Failed', 'You are already registered.', config.embedCorrect);
        return await interaction.editReply({ embeds: [embed] });
      }

      // Check if MC account is already registered
      const mcuser = await query('registered', 'findOne', { mc_user: name });
      if (mcuser) {
        if (mcuser.discord_id === interaction.user.id) {
          await query('registered', 'updateOne', 
            { mc_user: name },
            { $set: { discord_user: interaction.user.username } }
          );

          const embed = createEmbed(
            'Registration Updated', 
            `Your registration as ${name} has been updated.`, 
            config.embedCorrect
          );
          await interaction.editReply({ embeds: [embed] });
          await updateEloAndNickname(interaction.user.id, interaction.guild);
          return;
        } else {
          const embed = createEmbed('Registration Failed', 'Player already registered by another user.', config.embedCorrect);
          return await interaction.editReply({ embeds: [embed] });
        }
      }

      // Register the user
      await query('registered', 'insertOne', {
        mc_user: name,
        discord_user: interaction.user.username,
        discord_id: interaction.user.id
      });

      const initialElo = 0;
      const initialRank = getRankForElo(initialElo);

      await query('stats', 'insertOne', {
        discord_id: interaction.user.id,
        elo: initialElo,
        wins: 0,
        lost: 0,
        wlr: 0,
        rank: initialRank,
        games: 0,
        mvp: 0
      });

      const embed = createEmbed(
        'Registration Successful', 
        `You are now registered as ${name}.`, 
        config.embedCorrect
      );
      
      await interaction.editReply({ embeds: [embed] });
      await updateEloAndNickname(interaction.user.id, interaction.guild);

    } catch (error) {
      console.error('Error in register command:', error);
      const embed = createEmbed(
        'Registration Failed', 
        'An error occurred during registration. Please try again later.', 
        '#FF0000'
      );
      
      try {
        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  },
};