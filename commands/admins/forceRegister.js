const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { query } = require("../../database");
const axios = require("axios");
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
      .setName("force_register")
      .setDescription("Force register a user (Admin only)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption(option =>
          option.setName("user")
              .setDescription("The user to register")
              .setRequired(true)
      )
      .addStringOption(option =>
          option.setName("player")
              .setDescription("The Minecraft player name")
              .setRequired(true)
      ),

  async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser("user");
      const playerName = interaction.options.getString("player");

      try {
          const existingUser = await query('registered', 'findOne', { discord_id: targetUser.id });
          if (existingUser) {
              const embed = createEmbed('Registration Failed', `${targetUser.username} is already registered.`, config.embedCorrect);
              return interaction.editReply({ embeds: [embed], ephemeral: true });
          }

          await axios.get(`https://api.ngmc.co/v1/players/${playerName}`);

          const existingPlayer = await query('registered', 'findOne', { mc_user: playerName });
          if (existingPlayer) {
              const embed = createEmbed('Registration Failed', `${playerName} is already registered to another user.`, config.embedCorrect);
              return interaction.editReply({ embeds: [embed], ephemeral: true });
          }

          await query('registered', 'insertOne', {
              mc_user: playerName,
              discord_user: targetUser.username,
              discord_id: targetUser.id
          });

          const initialElo = 0;
          const initialRank = getRankForElo(initialElo);

          await query('stats', 'insertOne', {
              discord_id: targetUser.id,
              elo: initialElo,
              wins: 0,
              lost: 0,
              wlr: 0,
              rank: initialRank,
              games: 0,
              mvp: 0
          });

          const member = await interaction.guild.members.fetch(targetUser.id);
          await updateNickname(member, playerName, initialElo);

          const embed = createEmbed('Registration Successful', `Successfully registered ${targetUser.username} as ${playerName} with initial ELO ${initialElo} and rank ${initialRank}.`, config.embedCorrect);
          return interaction.editReply({ embeds: [embed], ephemeral: true });
      } catch (error) {
          console.error(error);
          const embed = createEmbed('Registration Failed', "An error occurred while processing the command.", '#FF0000');
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