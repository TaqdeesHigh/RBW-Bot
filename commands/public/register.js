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
    await interaction.deferReply({ ephemeral: true });
    try {
      const name = interaction.options.getString("name");
      const res = await axios.get(`https://api.ngmc.co/v1/players/${name}`);
      
      if (res.data.banned === true) {
        const embed = createEmbed('Registration Failed', 'You are banned from the server.', '#FF0000');
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }
     
      const discorduser = await query('registered', 'findOne', { discord_id: interaction.user.id });
      if (discorduser) {
        const embed = createEmbed('Registration Failed', 'You are already registered.', config.embedCorrect);
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }

      const mcuser = await query('registered', 'findOne', { mc_user: name });
      if (mcuser) {
        const embed = createEmbed('Registration Failed', 'Player already registered.', config.embedCorrect);
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }

      if (!mcuser && !discorduser) {
        try {
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

          // Use the new updateEloAndNickname function
          await updateEloAndNickname(interaction.user.id, interaction.guild);
          
          const embed = createEmbed('Registration Successful', `You are now registered as ${name} with initial ELO ${initialElo}.`, config.embedCorrect);
          return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          console.error(error);
          const embed = createEmbed('Registration Failed', 'Error registering user.', '#FF0000');
          return interaction.editReply({ embeds: [embed], ephemeral: true });
        }
      }
    } catch (error) {
      console.log(error);
      const embed = createEmbed('Registration Failed', 'Player not found.', '#FF0000');
      return interaction.editReply({ embeds: [embed], ephemeral: true });
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