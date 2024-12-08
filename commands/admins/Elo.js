const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');
const { query } = require('../../database');
const { getRankForElo, updatePlayerRoles } = require('../../eloCalc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Manage ELO for users')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
        // Check for admin permissions
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        
        // Get current user stats
        const userStats = await query('stats', 'findOne', { discord_id: user.id });
        if (!userStats) {
            return interaction.reply({ content: 'User not found in the database.', ephemeral: true });
        }

        try {
            switch (subcommand) {
                case 'add':
                    const addAmount = interaction.options.getInteger('amount');
                    const newElo = userStats.elo + addAmount;
                    const newRank = getRankForElo(newElo);
                    
                    await query('stats', 'updateOne', 
                        { discord_id: user.id },
                        { $set: { 
                            elo: newElo,
                            rank: newRank 
                        }}
                    );

                    // Update nickname and roles
                    await updateEloAndNickname(user.id, interaction.guild, addAmount);
                    await updatePlayerRoles(user.id, newRank, interaction.guildId, interaction.client);

                    await interaction.reply({
                        content: `Added ${addAmount} ELO to ${user.tag}\nNew ELO: ${newElo}\nNew Rank: ${newRank}`,
                        ephemeral: true
                    });
                    break;

                case 'remove':
                    const removeAmount = interaction.options.getInteger('amount');
                    const newEloAfterRemove = Math.max(0, userStats.elo - removeAmount);
                    const newRankAfterRemove = getRankForElo(newEloAfterRemove);
                    
                    await query('stats', 'updateOne', 
                        { discord_id: user.id },
                        { $set: { 
                            elo: newEloAfterRemove,
                            rank: newRankAfterRemove 
                        }}
                    );

                    // Update nickname and roles
                    await updateEloAndNickname(user.id, interaction.guild, -removeAmount);
                    await updatePlayerRoles(user.id, newRankAfterRemove, interaction.guildId, interaction.client);

                    await interaction.reply({
                        content: `Removed ${removeAmount} ELO from ${user.tag}\nNew ELO: ${newEloAfterRemove}\nNew Rank: ${newRankAfterRemove}`,
                        ephemeral: true
                    });
                    break;

                case 'fix':
                    const fixedRank = getRankForElo(userStats.elo);
                    
                    await query('stats', 'updateOne', 
                        { discord_id: user.id },
                        { $set: { rank: fixedRank } }
                    );

                    // Update nickname and roles
                    await updateEloAndNickname(user.id, interaction.guild, 0);
                    await updatePlayerRoles(user.id, fixedRank, interaction.guildId, interaction.client);

                    await interaction.reply({
                        content: `Fixed ELO for ${user.tag}\nCurrent ELO: ${userStats.elo}\nUpdated Rank: ${fixedRank}`,
                        ephemeral: true
                    });
                    break;
            }
        } catch (error) {
            console.error('Error executing elo command:', error);
            await interaction.reply({ 
                content: 'An error occurred while updating ELO. Please check the console for details.',
                ephemeral: true 
            });
        }
    },
};