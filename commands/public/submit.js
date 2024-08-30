const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit an MVP for the current game')
        .addUserOption(option =>
            option.setName('mvp')
                .setDescription('The MVP player')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('proof-picture')
                .setDescription('Proof picture for the MVP')
                .setRequired(true)),
    
    async execute(interaction) {
        const mvp = interaction.options.getUser('mvp');
        const proofPicture = interaction.options.getAttachment('proof-picture');

        // Check if the user is in a game
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        if (!voiceChannel || !voiceChannel.parent || !voiceChannel.parent.name.startsWith('Game-Started')) {
            return interaction.reply({ content: 'You must be in an active game voice channel to use this command.', ephemeral: true });
        }

        // Get the game number
        const gameNumber = voiceChannel.parent.name.split('-')[2];

        // Get the MVP's team
        let mvpTeam;
        if (voiceChannel.name === 'team-1') {
            mvpTeam = 1;
        } else if (voiceChannel.name === 'team-2') {
            mvpTeam = 2;
        } else {
            return interaction.reply({ content: 'Could not determine your team. Please ensure you are in a team voice channel.', ephemeral: true });
        }

        // Send message to games-log channel
        const gameLogsChannel = interaction.client.channels.cache.get(config.GAME_LOGS);
        if (!gameLogsChannel) {
            return interaction.reply({ content: 'Error: Games log channel not found.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Game #${gameNumber} MVP Submission`)
            .setDescription(`MVP: ${mvp.toString()} (Team ${mvpTeam})`)
            .setImage(proofPicture.url)
            .setTimestamp()
            .setFooter({ text: `Submitted by ${interaction.user.tag}` });

        await gameLogsChannel.send({ embeds: [embed] });

        return interaction.reply({ content: 'MVP submission successful!', ephemeral: true });
    },
};