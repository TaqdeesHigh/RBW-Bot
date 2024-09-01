const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');
const { eloCalc } = require('../../eloCalc');
const { query } = require('../../database');
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit an MVP for the current game')
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
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Proof image for the MVP')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
    
        const mvp = interaction.options.getUser('mvp');
        const winningTeam = interaction.options.getString('winning-team');
        const proofImage = interaction.options.getAttachment('image');
    
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

        // Determine winning and losing teams
        let winningTeamPlayers, losingTeamPlayers;
        if (winningTeam === 'team1') {
            winningTeamPlayers = team1Players;
            losingTeamPlayers = team2Players;
        } else {
            winningTeamPlayers = team2Players;
            losingTeamPlayers = team1Players;
        }

        // Calculate ELO changes
        const eloResults = await eloCalc(winningTeamPlayers, losingTeamPlayers, mvp.id);

        // Additional MVP ELO bonus
        const mvpPlayer = await query('stats', 'findOne', { discord_id: mvp.id });
        const mvpEloBonus = winningTeamPlayers.includes(mvp.id) ? 15 : 5;
        
        // Update MVP's ELO and nickname
        await updateEloAndNickname(mvp.id, interaction.guild, mvpEloBonus);

        // Update ELO and nicknames for all players
        for (const winner of eloResults.winners) {
            await updateEloAndNickname(winner.discord_id, interaction.guild, winner.newElo - winner.oldElo);
        }
        for (const loser of eloResults.losers) {
            await updateEloAndNickname(loser.discord_id, interaction.guild, loser.newElo - loser.oldElo);
        }

        // Send message to games-log channel
        const gameLogsChannel = interaction.client.channels.cache.get(config.GAME_LOGS);
        if (!gameLogsChannel) {
            return interaction.editReply('Error: Games log channel not found.');
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Game #${gameNumber} Results`)
            .setDescription(`Winning Team: ${winningTeam}\nMVP: ${mvp.toString()} (${mvpEloBonus} ELO bonus)`)
            .setImage(proofImage.url)
            .addFields(
                { name: 'Winning Team ELO Changes', value: eloResults.winners.map(w => `<@${w.discord_id}>: ${w.oldElo} → ${w.newElo}`).join('\n') },
                { name: 'Losing Team ELO Changes', value: eloResults.losers.map(l => `<@${l.discord_id}>: ${l.oldElo} → ${l.newElo}`).join('\n') }
            )
            .setTimestamp()
            .setFooter({ text: `Submitted by ${interaction.user.tag}` });

        await gameLogsChannel.send({ embeds: [embed] });

        const waitingChannelId = config.waitingChannel;
        if (waitingChannelId) {
            const waitingChannel = interaction.guild.channels.cache.get(waitingChannelId);
            
            if (waitingChannel) {
                const allPlayers = [...team1Players, ...team2Players];
                for (const playerId of allPlayers) {
                    const player = await interaction.guild.members.fetch(playerId);
                    if (player.voice.channel) {
                        await player.voice.setChannel(waitingChannel).catch(console.error);
                    }
                }
            } else {
                console.error('Waiting channel not found');
                await interaction.followUp('Warning: Could not find the waiting channel. Players were not moved.');
            }
        
            // Delete team channels
            await team1Channel.delete().catch(console.error);
            await team2Channel.delete().catch(console.error);
        
            // Delete game category
            await category.delete().catch(console.error);
        } else {
            console.error('Waiting channel ID not specified in config');
            await interaction.followUp('Warning: Waiting channel not specified in config. Players were not moved.');
        }
    },
};