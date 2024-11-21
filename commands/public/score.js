const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const { eloCalc } = require('../../eloCalc');
const { updateEloAndNickname } = require('../../events/Elo/updateNickName');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('score')
        .setDescription('Score a submitted game')
        .addStringOption(option =>
            option.setName('game-id')
                .setDescription('The game ID to score')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Game status')
                .setRequired(true)
                .addChoices(
                    { name: 'Validate', value: 'validated' },
                    { name: 'Void', value: 'voided' }
                )),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.editReply('You do not have permission to score games.');
        }

        const gameNumber = interaction.options.getString('game-id');
        const status = interaction.options.getString('status');

        try {
            // Retrieve game details from database
            const game = await query('games', 'findOne', { game_number: gameNumber });

            if (!game || game.status !== 'submitted') {
                return interaction.editReply('Game not found or not in submitted status.');
            }

            // Find the category and channels
            const guild = interaction.guild;
            
            const category = guild.channels.cache.find(
                c => c.name === `Game-2v2-${gameNumber}` && c.type === 4
            );

            if (!category) {
                return interaction.editReply(`Could not find game category for Game #${gameNumber}.`);
            }

            const team1Channel = category.children.cache.find(
                channel => channel.name === `Team 1 - Game ${gameNumber}` && channel.type === 2
            );
            const team2Channel = category.children.cache.find(
                channel => channel.name === `Team 2 - Game ${gameNumber}` && channel.type === 2
            );
            const gameTextChannel = category.children.cache.find(
                channel => channel.name === `game-${gameNumber}`
            );
            
            console.log('Channels in category:', category.children.cache.map(c => c.name));
            
            if (!team1Channel || !team2Channel || !gameTextChannel) {
                return interaction.editReply(`Could not find all required game channels. 
                Team 1 Channel: ${team1Channel ? 'Found' : 'Missing'}
                Team 2 Channel: ${team2Channel ? 'Found' : 'Missing'}
                Game Text Channel: ${gameTextChannel ? 'Found' : 'Missing'}`);
            }

            // Parse team members
            const team1Players = JSON.parse(game.team1_members);
            const team2Players = JSON.parse(game.team2_members);

            // Determine winning and losing teams
            let winningTeamPlayers, losingTeamPlayers;
            if (game.winning_team === 'team1') {
                winningTeamPlayers = team1Players;
                losingTeamPlayers = team2Players;
            } else {
                winningTeamPlayers = team2Players;
                losingTeamPlayers = team1Players;
            }

            // Update game status
            await query('games', 'updateOne', 
                { game_number: gameNumber }, 
                { $set: { status: status } }
            );

            // Only process ELO if game is validated
            if (status === 'validated') {
                // Calculate ELO changes
                const eloResults = await eloCalc(winningTeamPlayers, losingTeamPlayers, game.mvp);

                // Additional MVP ELO bonus
                const mvpEloBonus = winningTeamPlayers.includes(game.mvp) ? 15 : 5;
                
                // Update MVP's ELO and nickname
                await updateEloAndNickname(game.mvp, interaction.guild, mvpEloBonus);

                // Update ELO and nicknames for all players
                for (const winner of eloResults.winners) {
                    await updateEloAndNickname(winner.discord_id, interaction.guild, winner.newElo - winner.oldElo);
                }
                for (const loser of eloResults.losers) {
                    await updateEloAndNickname(loser.discord_id, interaction.guild, loser.newElo - loser.oldElo);
                }

                // Send detailed ELO changes to game logs
                const gameLogsChannel = interaction.client.channels.cache.get(config.GAME_LOGS);
                if (gameLogsChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(`Game #${gameNumber} Validated`)
                        .setDescription(`MVP: <@${game.mvp}> (${mvpEloBonus} ELO bonus)`)
                        .addFields(
                            { name: 'Winning Team ELO Changes', value: eloResults.winners.map(w => `<@${w.discord_id}>: ${w.oldElo} → ${w.newElo}`).join('\n') },
                            { name: 'Losing Team ELO Changes', value: eloResults.losers.map(l => `<@${l.discord_id}>: ${l.oldElo} → ${l.newElo}`).join('\n') },
                            { name: 'Bed Breaker', value: `<@${game.bed_breaker}>` }
                        )
                        .setTimestamp();

                    await gameLogsChannel.send({ embeds: [embed] });
                }
            }

            // Move players to waiting channel if validated
            if (status === 'validated' && config.waitingChannel) {
                const waitingChannel = interaction.guild.channels.cache.get(config.waitingChannel);
                if (waitingChannel) {
                    const allPlayers = [...team1Players, ...team2Players];
                    for (const playerId of allPlayers) {
                        const player = await interaction.guild.members.fetch(playerId);
                        if (player.voice.channel) {
                            await player.voice.setChannel(waitingChannel).catch(console.error);
                        }
                    }
                }
            }

            // Send countdown message in game text channel
            const countdownEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Game Channels Deletion')
                .setDescription(`Game channels will be deleted in 60 seconds. Please ensure you have all necessary information.`);

            await gameTextChannel.send({ embeds: [countdownEmbed] });

            // Schedule channel and category deletion
            setTimeout(async () => {
                try {
                    // Delete team channels
                    await team1Channel.delete('Game scored');
                    await team2Channel.delete('Game scored');

                    // Delete game text channel
                    await gameTextChannel.delete('Game scored');

                    // Delete category
                    await category.delete('Game scored');
                } catch (deleteError) {
                    console.error('Error deleting game channels:', deleteError);
                    // Optionally, log this to a specific error channel
                }
            }, 60000); // 60 seconds

            await interaction.editReply(`Game #${gameNumber} has been ${status}. Channels will be deleted in 60 seconds.`);

        } catch (error) {
            console.error('Error scoring game:', error);
            await interaction.editReply('Failed to score game. Please contact a system administrator.');
        }
    },
};