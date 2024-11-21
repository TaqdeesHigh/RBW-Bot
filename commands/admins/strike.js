const { SlashCommandBuilder } = require('discord.js');
const { query } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Manage user strikes')
    .addSubcommand(subcommand => 
      subcommand
        .setName('give')
        .setDescription('Give strikes to a user')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('User to give strikes to')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('amount')
            .setDescription('Number of strikes to give')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('remove')
        .setDescription('Remove strikes from a user')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('User to remove strikes from')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('amount')
            .setDescription('Number of strikes to remove')
            .setRequired(true)))
    .addSubcommand(subcommand => 
      subcommand
        .setName('set')
        .setDescription('Set strikes for a user')
        .addUserOption(option => 
          option.setName('user')
            .setDescription('User to set strikes for')
            .setRequired(true))
        .addIntegerOption(option => 
          option.setName('amount')
            .setDescription('Number of strikes to set')
            .setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.reply({ content: 'You do not have permission to manage strikes.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
      // Find existing strike record
      let strikeRecord = await query('punishments', 'findOne', { 
        discord_id: user.id, 
        type: 'strike' 
      });

      let currentStrikes = strikeRecord ? strikeRecord.amount : 0;

      switch(subcommand) {
        case 'give':
          currentStrikes += amount;
          break;
        case 'remove':
          currentStrikes = Math.max(0, currentStrikes - amount);
          break;
        case 'set':
          currentStrikes = amount;
          break;
      }

      // Insert or update strike record
      if (strikeRecord) {
        await query('punishments', 'updateOne', 
          { discord_id: user.id, type: 'strike' }, 
          { $set: { 
            amount: currentStrikes, 
            issued_by: interaction.user.id 
          }}
        );
      } else {
        await query('punishments', 'insertOne', {
          discord_id: user.id,
          type: 'strike',
          amount: currentStrikes,
          issued_by: interaction.user.id
        });
      }

      await interaction.reply({ 
        content: `${user} now has ${currentStrikes} strikes.`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Strike management error:', error);
      await interaction.reply({ 
        content: 'An error occurred while managing strikes.', 
        ephemeral: true 
      });
    }
  }
};