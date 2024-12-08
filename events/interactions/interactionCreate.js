const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../../config.json');
const { query } = require('../../database');
const RandomTeam = require('../Teams/RandomTeam');
const ChooseTeams = require('../Teams/ChooseTeams');
const { eloCalc } = require('../../eloCalc');

// Store votes per game
const gameVotes = new Map(); // Map to store votes for each game
const userVotes = new Map(); // Map to store which users have voted in each game

// Utility function to calculate Win-Loss Ratio
const calculateWLR = (wins, losses) => {
    if (losses === 0) {
        return wins > 0 ? 99.99 : 0; // Handle special cases
    }
    return Number((wins / losses).toFixed(2));
};

module.exports = {
    name: 'interactionCreate',

    async execute(interaction, client) {
        // Handle chat input commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                return interaction.reply({content: 'Outdated Command'});
            }

            return command.execute(interaction, client);
        }

        // Handle button interactions
        if (interaction.isButton()) {
            // Handle RBW notification buttons
            if (interaction.customId === 'rbw_on' || interaction.customId === 'rbw_off') {
                const registeredUser = await query('registered', 'findOne', { discord_id: interaction.user.id });
                
                if (!registeredUser) {
                    return await interaction.reply({
                        content: "You need to be registered to manage your RBW ping settings.",
                        ephemeral: true
                    });
                }

                const role = interaction.guild.roles.cache.get(config.rbwID);
                const hasRole = interaction.member.roles.cache.has(config.rbwID);

                if (interaction.customId === 'rbw_on') {
                    if (hasRole) {
                        return await interaction.reply({
                            content: "You already have RBW ping notifications enabled.",
                            ephemeral: true
                        });
                    }
                    await interaction.member.roles.add(role);
                    return await interaction.reply({
                        content: "You will now receive RBW ping notifications.",
                        ephemeral: true
                    });
                } else {
                    if (!hasRole) {
                        return await interaction.reply({
                            content: "You already have RBW ping notifications disabled.",
                            ephemeral: true
                        });
                    }
                    await interaction.member.roles.remove(role);
                    return await interaction.reply({
                        content: "You will no longer receive RBW ping notifications.",
                        ephemeral: true
                    });
                }
            }

            // Game validation buttons
            if (interaction.customId.startsWith('game_validate_') || 
                interaction.customId.startsWith('game_void_')) {
                
                // Check if the user has administrator permissions
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ 
                        content: 'Only administrators can validate or void games.', 
                        ephemeral: true 
                    });
                }

                const [action, gameNumber] = interaction.customId.split('_');
                
                try {
                    // Perform game scoring logic
                    const game = await query('games', 'findOne', { game_number: gameNumber });
                    
                    if (!game) {
                        return interaction.reply({
                            content: 'Game not found.',
                            ephemeral: true
                        });
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
                    const status = action === 'validate' ? 'validated' : 'voided';
                    await query('games', 'updateOne', 
                        { game_number: gameNumber }, 
                        { $set: { status: status } }
                    );

                    // Only process additional logic if validated
                    if (status === 'validated') {
                        // Calculate ELO changes (you'll need to implement eloCalc function)
                        const eloResults = await eloCalc(
                            winningTeamPlayers, 
                            losingTeamPlayers, 
                            game.mvp, 
                            interaction.guildId,
                            client
                        );

                        // Update statistics for players
                        for (const player of [...winningTeamPlayers, ...losingTeamPlayers]) {
                            const isWinner = winningTeamPlayers.includes(player);
                            
                            // Retrieve current user stats
                            const userStatsResult = await query(null, 'raw', 
                                'SELECT * FROM stats WHERE discord_id = ? LIMIT 1', 
                                [player]
                            );
                            const userStats = userStatsResult[0];
                            
                            // Calculate new stats
                            const currentWins = userStats?.wins || 0;
                            const currentLosses = userStats?.lost || 0;
                            const currentGames = userStats?.games || 0;
                            
                            const newWins = isWinner ? currentWins + 1 : currentWins;
                            const newLosses = isWinner ? currentLosses : currentLosses + 1;
                            const newGames = currentGames + 1;
                            const newWLR = calculateWLR(newWins, newLosses);
                            
                            // Update stats
                            await query(null, 'raw', 
                                `UPDATE stats 
                                SET wins = ?, 
                                    lost = ?, 
                                    wlr = ?, 
                                    games = ?
                                WHERE discord_id = ?`, 
                                [newWins, newLosses, newWLR, newGames, player]
                            );
                        }
                    }

                    // Disable the buttons and update the message
                    const originalEmbed = interaction.message.embeds[0];
                    const disabledButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('game_processed')
                                .setLabel(`Game ${status.toUpperCase()}D`)
                                .setStyle(status === 'validated' ? ButtonStyle.Success : ButtonStyle.Danger)
                                .setDisabled(true)
                        );

                    await interaction.update({ 
                        embeds: [originalEmbed], 
                        components: [disabledButtons] 
                    });

                    // Send confirmation message
                    await interaction.followUp({
                        content: `Game #${gameNumber} has been ${status}.`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Error processing game validation:', error);
                    await interaction.reply({ 
                        content: 'Failed to process game. Please contact a system administrator.', 
                        ephemeral: true 
                    });
                }
            }

            // Existing team selection voting logic
            const [action, randomVotes, chooseVotes, gameNumber] = interaction.customId.split(':');

            // Check if this is a team selection button
            if (action === 'random' || action === 'choose') {
                const userId = interaction.user.id;
                const gameKey = `game-${gameNumber}`;

                // Initialize game votes if not exists
                if (!gameVotes.has(gameKey)) {
                    gameVotes.set(gameKey, { random: 0, choose: 0 });
                    userVotes.set(gameKey, new Set());
                }

                // Check if user has already voted
                if (userVotes.get(gameKey).has(userId)) {
                    return interaction.reply({ 
                        content: 'You have already voted!', 
                        ephemeral: true 
                    });
                }

                // Record the vote
                const votes = gameVotes.get(gameKey);
                if (action === 'random') {
                    votes.random++;
                } else {
                    votes.choose++;
                }
                userVotes.get(gameKey).add(userId);

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`random:${votes.random}:${votes.choose}:${gameNumber}`)
                            .setLabel(`Random (${votes.random})`)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`choose:${votes.random}:${votes.choose}:${gameNumber}`)
                            .setLabel(`Choose (${votes.choose})`)
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.update({ components: [newRow] });

                // Start the 15-second timer if it hasn't been started yet
                if (!interaction.message.timerStarted) {
                    interaction.message.timerStarted = true;
                    setTimeout(async () => {
                        // Get the final vote counts from our stored votes
                        const finalVotes = gameVotes.get(gameKey);
                        const finalRandomVotes = finalVotes.random;
                        const finalChooseVotes = finalVotes.choose;

                        // Clean up vote tracking
                        gameVotes.delete(gameKey);
                        userVotes.delete(gameKey);

                        // Delete the voting message
                        await interaction.message.delete();

                        // Determine the winner or randomly select if tied
                        let winner;
                        if (finalRandomVotes > finalChooseVotes) {
                            winner = 'random';
                        } else if (finalChooseVotes > finalRandomVotes) {
                            winner = 'choose';
                        } else {
                            winner = Math.random() < 0.5 ? 'random' : 'choose';
                        }

                        // Retrieve game from database
                        const game = await query('games', 'findOne', { game_number: gameNumber });

                        if (!game) {
                            await interaction.channel.send("Error: Game not found in database.");
                            return;
                        }

                        const voiceChannel = interaction.guild.channels.cache.get(game.voice_channel_id);
                        const textChannel = interaction.channel;

                        if (!voiceChannel) {
                            await textChannel.send("Error: Couldn't find the associated voice channel.");
                            return;
                        }

                        if (winner === 'random') {
                            const embed = new EmbedBuilder()
                                .setColor('#FF4500')
                                .setTitle(`🎲 Random Team Selection - Game ${gameNumber}`)
                                .setDescription('Random team selection has won the vote. Initiating team formation...')
                                .setTimestamp();
                            await textChannel.send({ embeds: [embed] });
                            await RandomTeam.execute(textChannel, voiceChannel, game.gamemode, client);
                        } else {
                            const embed = new EmbedBuilder()
                                .setColor('#4169E1')
                                .setTitle(`👥 Manual Team Selection - Game ${gameNumber}`)
                                .setDescription('Manual team selection has won the vote. Captains will now choose their teams.')
                                .setTimestamp();
                            await textChannel.send({ embeds: [embed] });
                            await ChooseTeams.execute(textChannel, voiceChannel, game.gamemode, client);
                        }
                    }, 15000);
                }
            }
        }
    },
};