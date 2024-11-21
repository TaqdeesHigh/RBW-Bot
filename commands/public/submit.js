const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');
const { query } = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit a game for review')
        .addUserOption(option =>
            option.setName('mvp')
                .setDescription('The MVP player')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('winning-team')
                .setDescription('The winning team')
                .setRequired(true)
                .addChoices(
                    { name: 'Team 1', value: 'team1' },
                    { name: 'Team 2', value: 'team2' }
                ))
        .addUserOption(option =>
            option.setName('bed-breaker')
                .setDescription('Player who broke the bed')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Proof image for the game')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
    
        const mvp = interaction.options.getUser('mvp');
        const winningTeam = interaction.options.getString('winning-team');
        const proofImage = interaction.options.getAttachment('image');
        const bedBreaker = interaction.options.getUser('bed-breaker');

        // Check if the command is used in the correct channel
        if (!interaction.channel.name.startsWith('game-')) {
            return interaction.editReply('This command can only be used in a game text channel.');
        }

        const gameNumber = interaction.channel.name.split('-')[1];
        
        const category = interaction.channel.parent;
        if (!category || !category.name.startsWith('Game-')) {
            return interaction.editReply('Unable to determine game mode. Please check the category naming convention.');
        }

        const [, gameMode, categoryGameNumber] = category.name.split('-');

        if (gameNumber !== categoryGameNumber) {
            return interaction.editReply('Game number mismatch between channel and category. Please check the naming convention.');
        }

        const team1Channel = category.children.cache.find(channel => channel.name.startsWith('Team 1 - Game') && channel.type === 2);
        const team2Channel = category.children.cache.find(channel => channel.name.startsWith('Team 2 - Game') && channel.type === 2);
        
        if (!team1Channel || !team2Channel) {
            return interaction.editReply('Could not find team channels. Please ensure they are named "Team 1 - Game {number}" and "Team 2 - Game {number}".');
        }
        
        // Get players in each team
        const team1Players = team1Channel.members.map(member => member.id);
        const team2Players = team2Channel.members.map(member => member.id);

        // Validate bed breaker is in the game
        const allGamePlayers = [...team1Players, ...team2Players];
        if (!allGamePlayers.includes(bedBreaker.id)) {
            return interaction.editReply('Bed breaker must be a player in the game.');
        }

        // Validate MVP is in the game
        if (!allGamePlayers.includes(mvp.id)) {
            return interaction.editReply('MVP must be a player in the game.');
        }

        try {
            // Update game in database to 'submitted' status
            await query('games', 'updateOne', 
                { game_number: gameNumber }, 
                { $set: { 
                    status: 'submitted',
                    winning_team: winningTeam,
                    mvp: mvp.id,
                    proof_image: proofImage.url,
                    bed_breaker: bedBreaker.id,
                    team1_members: JSON.stringify(team1Players),
                    team2_members: JSON.stringify(team2Players)
                }}
            );

            // Send message to games-log channel
            const gameLogsChannel = interaction.client.channels.cache.get(config.GAME_LOGS);
            if (!gameLogsChannel) {
                return interaction.editReply('Error: Games log channel not found.');
            }

            const embed = new EmbedBuilder()
                .setColor('#FFFF00')
                .setTitle(`Game #${gameNumber} Submitted for Review`)
                .setDescription(`Game Mode: ${gameMode}`)
                .addFields(
                    { name: 'Winning Team', value: winningTeam },
                    { name: 'MVP', value: mvp.toString() },
                    { name: 'Bed Breaker', value: bedBreaker.toString() }
                )
                .setImage(proofImage.url)
                .setTimestamp()
                .setFooter({ text: `Submitted by ${interaction.user.tag}` });

            await gameLogsChannel.send({ embeds: [embed] });

            await interaction.editReply('Game submitted for review. An admin will process the score soon.');

        } catch (error) {
            console.error('Error submitting game:', error);
            await interaction.editReply('Failed to submit game. Please contact an administrator.');
        }
    },
};