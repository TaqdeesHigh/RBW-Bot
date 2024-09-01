const { SlashCommandBuilder } = require('@discordjs/builders');
const { updatePunishment } = require('../../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');

        // Update database
        await updatePunishment(user.id, null, null, 'expired');

        await interaction.reply(`User ${user.tag} has been unbanned.`);
    },
};