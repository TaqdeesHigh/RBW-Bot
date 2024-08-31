const { PermissionsBitField } = require('discord.js');

async function createGameChannel(guild, gameNumber, gamemode, members) {
  // Create a new category for the game
  const gameCategory = await guild.channels.create({
    name: `Game-${gamemode}-${gameNumber}`,
    type: 4, // 4 is the channel type for categories
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      ...members.map(member => ({
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
      })),
    ],
  });

  // Create a single voice channel for the game
  const gameVoiceChannel = await guild.channels.create({
    name: `game-${gameNumber}`,
    type: 2, // 2 is the channel type for voice channels
    parent: gameCategory.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      ...members.map(member => ({
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
      })),
    ],
  });

  // Move all members to the new voice channel
  for (const member of members) {
    await member.voice.setChannel(gameVoiceChannel);
  }

  return { category: gameCategory, voiceChannel: gameVoiceChannel };
}

module.exports = { createGameChannel };