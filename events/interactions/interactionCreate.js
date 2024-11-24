const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const RandomTeam = require('../Teams/RandomTeam');
const ChooseTeams = require('../Teams/ChooseTeams');

// Store votes per game
const gameVotes = new Map(); // Map to store votes for each game
const userVotes = new Map(); // Map to store which users have voted in each game

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