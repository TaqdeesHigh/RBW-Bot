const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ss')
        .setDescription('Request a screen share from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to request a screen share from')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        // Check if the user is in a voice channel
        if (!targetMember.voice.channel) {
            return interaction.editReply('The specified user is not in a voice channel.');
        }

        // Check if the user is in a game channel
        const isInGame = targetMember.voice.channel.parent && targetMember.voice.channel.parent.name.startsWith('Game-');
        if (!isInGame) {
            return interaction.editReply('The specified user is not currently in a game.');
        }

        // Get the screenshare channel
        const ssChannelId = config.ssChannel;
        const ssChannel = interaction.client.channels.cache.get(ssChannelId);

        if (!ssChannel) {
            return interaction.editReply('Error: Screenshare channel not found.');
        }

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Screen Share Request')
            .setDescription(`${targetUser} is being requested to screen share.`)
            .addFields(
                { name: 'Warning', value: 'If you leave the server or voice channel, you will be banned from queuing.' }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        // Send the message to the screenshare channel
        await ssChannel.send({ content: `${targetUser}`, embeds: [embed] });

        // Reply to the command user
        await interaction.editReply(`Screen share request for ${targetUser} has been sent to the screenshare channel.`);
    },
};