const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const RandomTeam = require('../Teams/RandomTeam');
const ChooseTeams = require('../Teams/ChooseTeams');

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
            const [action, randomVotes, chooseVotes] = interaction.customId.split(':');

            // Check if this is a team selection button or a game creation button
            if (action === 'random' || action === 'choose') {
                // Handle voting for team selection method
                let newRandomVotes = parseInt(randomVotes || '0');
                let newChooseVotes = parseInt(chooseVotes || '0');

                if (action === 'random') {
                    newRandomVotes++;
                } else if (action === 'choose') {
                    newChooseVotes++;
                }

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`random:${newRandomVotes}:${newChooseVotes}`)
                            .setLabel(`Random (${newRandomVotes})`)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`choose:${newRandomVotes}:${newChooseVotes}`)
                            .setLabel(`Choose (${newChooseVotes})`)
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.update({ components: [newRow] });

                // Start the 15-second timer if it hasn't been started yet
                if (!interaction.message.timerStarted) {
                    interaction.message.timerStarted = true;
                    setTimeout(async () => {
                        // Get the final vote counts
                        const finalRandomVotes = parseInt(interaction.message.components[0].components[0].customId.split(':')[1]);
                        const finalChooseVotes = parseInt(interaction.message.components[0].components[1].customId.split(':')[2]);

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
                        const gameNumber = interaction.channel.name.split('-')[1];
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