const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const RandomTeam = require('../Teams/RandomTeam.js');
const ChooseTeams = require('../Teams/ChooseTeams.js');

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
            let newRandomVotes = parseInt(randomVotes);
            let newChooseVotes = parseInt(chooseVotes);

            const gameNumber = interaction.channel.name.split('-')[1];
            const gamemode = interaction.channel.parent.name.split('-')[1];

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

                    const channel = interaction.channel;
                    const category = channel.parent;
                    const voiceChannel = category.children.cache.find(ch => ch.name === `game-${gameNumber}` && ch.type === 2);  // 2 is the channel type for voice channels

                    if (!voiceChannel) {
                        await channel.send("Error: Couldn't find the associated voice channel.");
                        return;
                    }

                    if (winner === 'random') {
                        const embed = new EmbedBuilder()
                            .setColor('#FF4500')
                            .setTitle(`🎲 Random Team Selection - Game ${gameNumber}`)
                            .setDescription('Random team selection has won the vote. Initiating team formation...')
                            .setTimestamp();
                        await channel.send({ embeds: [embed] });
                        await RandomTeam.execute(channel, voiceChannel, gamemode, client);
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor('#4169E1')
                            .setTitle(`👥 Manual Team Selection - Game ${gameNumber}`)
                            .setDescription('Manual team selection has won the vote. Captains will now choose their teams.')
                            .setTimestamp();
                        await channel.send({ embeds: [embed] });
                        await ChooseTeams.execute(channel, voiceChannel, gamemode, client);
                    }
                }, 15000);
            }
        }
    },
};