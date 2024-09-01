const { SlashCommandBuilder } = require('@discordjs/builders');
const { updatePunishment } = require('../../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('Ban duration (e.g., 7d for 7 days)').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ban').setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');

        // Calculate expiration date
        const expiration = calculateExpirationDate(duration);

        // Update database
        await updatePunishment(user.id, reason, expiration, 'banned');

        await interaction.reply(`User ${user.tag} has been banned for ${duration} due to: ${reason}`);
    },
};

function calculateExpirationDate(duration) {
    // Implement logic to calculate expiration date based on duration string
    // Return a Date object
}