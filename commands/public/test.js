const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Embed, time} = require('discord.js');
const {ThemeColor} = require('../../config.json')
const { eloCalc } = require('../../eloCalc.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('test command'),

    async execute(interaction) {
        try {

            const winners = [`${interaction.user.id}`, '1185618985518116925'];
            const losers = ['1075805448340504606', '1225862306970206320'];
            eloCalc(winners, losers, interaction.user.id);

        } catch (error) {
            console.log(error)
        }
    }
}