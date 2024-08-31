const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { query } = require('../../database');
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fix')
        .setDescription('Fix all user nicknames based on their current ELO (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const allUsers = await query('stats', 'find', {});
            let updatedCount = 0;
            let failedCount = 0;

            for (const user of allUsers) {
                try {
                    await updateEloAndNickname(user.discord_id, interaction.guild, 0);
                    updatedCount++;
                } catch (error) {
                    console.error(`Failed to update user ${user.discord_id}:`, error);
                    failedCount++;
                }
            }

            await interaction.editReply({
                content: `Fix operation completed.\nUpdated: ${updatedCount} users\nFailed: ${failedCount} users`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in fix command:', error);
            await interaction.editReply({
                content: 'An error occurred while trying to fix nicknames. Please check the logs.',
                ephemeral: true
            });
        }
    },
};