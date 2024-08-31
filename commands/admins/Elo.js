const { SlashCommandBuilder } = require('discord.js');
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');
const { query } = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Manage ELO for users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add ELO to a user')
                .addIntegerOption(option => 
                    option.setName('amount')
                        .setDescription('Amount of ELO to add')
                        .setRequired(true))
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to add ELO to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove ELO from a user')
                .addIntegerOption(option => 
                    option.setName('amount')
                        .setDescription('Amount of ELO to remove')
                        .setRequired(true))
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to remove ELO from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix')
                .setDescription('Fix ELO for a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to fix ELO for')
                        .setRequired(true))),
    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');

        switch (subcommand) {
            case 'add':
                const addAmount = interaction.options.getInteger('amount');
                await updateEloAndNickname(user.id, interaction.guild, addAmount);
                await interaction.reply(`Added ${addAmount} ELO to ${user.tag}`);
                break;

            case 'remove':
                const removeAmount = interaction.options.getInteger('amount');
                await updateEloAndNickname(user.id, interaction.guild, -removeAmount);
                await interaction.reply(`Removed ${removeAmount} ELO from ${user.tag}`);
                break;

            case 'fix':
                try {
                    const userStats = await query('stats', 'findOne', { discord_id: user.id });
                    if (!userStats) {
                        return interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                    }

                    await updateEloAndNickname(user.id, interaction.guild, 0);
                    await interaction.reply(`Fixed ELO for ${user.tag}. Current ELO: ${userStats.elo}`);
                } catch (error) {
                    console.error('Error fixing ELO:', error);
                    await interaction.reply({ content: 'An error occurred while fixing the ELO.', ephemeral: true });
                }
                break;
        }
    },
};