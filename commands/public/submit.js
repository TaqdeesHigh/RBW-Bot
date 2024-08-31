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
    
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        if (!voiceChannel || !voiceChannel.parent) {
            return interaction.editReply('You must be in an active game voice channel to use this command.');
        }
    
        // Extract game number and mode from the category name
        const categoryNameParts = voiceChannel.parent.name.split('-');
        const gameNumber = categoryNameParts[2];
        const gameMode = categoryNameParts[3];
    
        if (!gameNumber || !gameMode) {
            return interaction.editReply('Unable to determine game number and mode. Please check the category naming convention.');
        }
    
        // Get players in each team
        const team1Channel = interaction.guild.channels.cache.find(channel => channel.name.startsWith('team-1') && channel.parent === voiceChannel.parent);
        const team2Channel = interaction.guild.channels.cache.find(channel => channel.name.startsWith('team-2') && channel.parent === voiceChannel.parent);
    
        if (!team1Channel || !team2Channel) {
            return interaction.editReply('Could not find team channels.');
        }

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

        // Move players back to queuing channels and delete team channels
        const otherData = await query('others', 'findOne', { guild_id: interaction.guild.id });
        if (otherData) {
            const queueChannelId = otherData[`channel_${gameMode}`];
            const queueChannel = interaction.guild.channels.cache.get(queueChannelId);
            
            if (queueChannel) {
                const allPlayers = [...team1Players, ...team2Players];
                for (const playerId of allPlayers) {
                    const player = await interaction.guild.members.fetch(playerId);
                    if (player.voice.channel) {
                        await player.voice.setChannel(queueChannel).catch(console.error);
                    }
                }
            }

            // Delete team channels
            await team1Channel.delete().catch(console.error);
            await team2Channel.delete().catch(console.error);

            // Delete game category
            await voiceChannel.parent.delete().catch(console.error);
        }

        await interaction.editReply('Game results submitted, players moved back to queue, and channels cleaned up!');
    },
};