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
    return config.ranks[0]; // Default to lowest rank
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
    const name = interaction.options.getString("name");

    try {
      // Try to fetch the player data first without deferring
      let playerExists = true;
      try {
        await axios.get(`https://api.ngmc.co/v1/players/${name}`);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          playerExists = false;
          const embed = createEmbed(
            'Registration Failed', 
            'This player does not exist.', 
            '#FF0000'
          );
          return await interaction.reply({ embeds: [embed] }); // Non-ephemeral reply
        }
      }

      if (!playerExists) return;

      // If player exists, continue with registration process
      await interaction.deferReply({ ephemeral: true });
      
      const res = await axios.get(`https://api.ngmc.co/v1/players/${name}`);
      
      if (res.data.banned === true) {
        const embed = createEmbed('Registration Failed', 'You are banned from the server.', '#FF0000');
        return await interaction.editReply({ embeds: [embed] });
      }
      
      const discorduser = await query('registered', 'findOne', { discord_id: interaction.user.id });
      if (discorduser) {
        const embed = createEmbed('Registration Failed', 'You are already registered.', config.embedCorrect);
        return await interaction.editReply({ embeds: [embed] });
      }

      const mcuser = await query('registered', 'findOne', { mc_user: name });
      if (mcuser) {
        const embed = createEmbed('Registration Failed', 'Player already registered.', config.embedCorrect);
        return await interaction.editReply({ embeds: [embed] });
      }

      if (!mcuser && !discorduser) {
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

        await updateEloAndNickname(interaction.user.id, interaction.guild);
        
        const embed = createEmbed(
          'Registration Successful', 
          `You are now registered as ${name} with initial ELO ${initialElo}.`, 
          config.embedCorrect
        );
        return await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in register command:', error);
      
      if (interaction.deferred || interaction.replied) {
        const embed = createEmbed(
          'Registration Failed', 
          'An error occurred during registration. Please try again later.', 
          '#FF0000'
        );
        await interaction.editReply({ embeds: [embed] }).catch(console.error);
      } else {
        const embed = createEmbed(
          'Registration Failed', 
          'An error occurred during registration. Please try again later.', 
          '#FF0000'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true }).catch(console.error);
      }
    }
  },
};

async function updateNickname(member, name, elo) {
  try {
    if (member.guild.members.me.permissions.has('ManageNicknames') &&
        member.manageable) {
      await member.setNickname(`${elo} - ${name}`);
    } else {
      console.log("Can't change nickname for this user");
    }
  } catch (error) {
    console.error("Failed to update nickname:", error);
  }
}