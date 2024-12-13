const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

// Track active void operations
const activeVoids = new Set();

// Helper functions
async function checkAndSetVoidLock(gameNumber) {
    if (activeVoids.has(gameNumber)) {
        return false;
    }
    activeVoids.add(gameNumber);
    return true;
}

function removeVoidLock(gameNumber) {
    activeVoids.delete(gameNumber);
}

async function safeDeleteChannel(channel) {
    try {
        if (channel && !channel.deleted) {
            await channel.delete();
        }
    } catch (error) {
        if (error.code !== 10003) { // Ignore "Unknown Channel" errors
            console.error(`Error deleting channel: ${error}`);
        }
    }
}

async function safeSendMessage(channel, content) {
    try {
        if (channel && !channel.deleted) {
            return await channel.send(content);
        }
    } catch (error) {
        if (error.code !== 10003) { // Ignore "Unknown Channel" errors
            console.error(`Error sending message: ${error}`);
        }
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('void')
        .setDescription('Start a vote to void the current game'),

    async execute(interaction) {
        let gameNumber;
        try {
            const channelName = interaction.channel.name;
            gameNumber = channelName.split('-')[1];

            if (!gameNumber) {
                return await interaction.reply({ content: 'This command can only be used in game channels!', ephemeral: true });
            }

            // Check if void is already in progress
            if (!await checkAndSetVoidLock(gameNumber)) {
                return await interaction.reply({ 
                    content: 'A void operation is already in progress for this game.', 
                    ephemeral: true 
                });
            }

            const game = await query('games', 'findOne', { game_number: gameNumber });
            if (!game) {
                removeVoidLock(gameNumber);
                return await interaction.reply({ content: 'No active game found in this channel!', ephemeral: true });
            }

            if (game.status === 'voided') {
                removeVoidLock(gameNumber);
                return await interaction.reply({ 
                    content: 'This game has already been voided.', 
                    ephemeral: true 
                });
            }

            const proceedVotes = new Set();
            const cancelVotes = new Set();

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Void Game Vote')
                .setDescription(`Voting to void Game #${gameNumber}\nEnds in 30 seconds`)
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`void_proceed_${gameNumber}`)
                        .setLabel(`Proceed (0)`)
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`void_cancel_${gameNumber}`)
                        .setLabel(`Cancel (0)`)
                        .setStyle(ButtonStyle.Secondary)
                );

            const voteMessage = await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                fetchReply: true 
            });

            const filter = i => i.customId.startsWith('void_');
            const collector = voteMessage.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (i.customId === `void_proceed_${gameNumber}`) {
                    cancelVotes.delete(i.user.id);
                    proceedVotes.add(i.user.id);
                } else if (i.customId === `void_cancel_${gameNumber}`) {
                    proceedVotes.delete(i.user.id);
                    cancelVotes.add(i.user.id);
                }

                const updatedRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`void_proceed_${gameNumber}`)
                            .setLabel(`Proceed (${proceedVotes.size})`)
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`void_cancel_${gameNumber}`)
                            .setLabel(`Cancel (${cancelVotes.size})`)
                            .setStyle(ButtonStyle.Secondary)
                    );

                await i.update({ components: [updatedRow] });
            });

            collector.on('end', async collected => {
                const proceedCount = proceedVotes.size;
                const cancelCount = cancelVotes.size;

                // Get current game status before proceeding
                const currentGame = await query('games', 'findOne', { game_number: gameNumber });
                if (!currentGame || currentGame.status === 'voided') {
                    removeVoidLock(gameNumber);
                    return;
                }

                const logChannel = interaction.client.channels.cache.get(config.logsChannel);

                if (proceedCount === cancelCount) {
                    const shouldVoid = Math.random() < 0.5;
                    
                    const tiebreakEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`Votes were tied ${proceedCount}-${cancelCount}. Random decision: ${shouldVoid ? 'Game will be voided' : 'Game will continue'}`)
                        .setTimestamp();

                    await safeSendMessage(interaction.channel, { 
                        content: null, 
                        embeds: [tiebreakEmbed], 
                        components: [] 
                    });

                    if (shouldVoid) {
                        await voidGame(interaction.guild, currentGame, logChannel);
                    }
                } else if (proceedCount > cancelCount) {
                    await voidGame(interaction.guild, currentGame, logChannel);
                } else {
                    await safeSendMessage(interaction.channel, {
                        content: null,
                        embeds: [],
                        components: []
                    });
                }
                removeVoidLock(gameNumber);
            });
        } catch (error) {
            console.error('Error in void command:', error);
            if (gameNumber) {
                removeVoidLock(gameNumber);
            }
        }
    }
};

async function voidGame(guild, game, logChannel) {
    try {
        // Immediately update game status to prevent race conditions
        await query('games', 'updateOne', 
            { game_number: game.game_number },
            { $set: { status: 'voided' }}
        );

        if (logChannel) {
            const voidPassedEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`**Game** \`#${game.game_number}\` **void vote passed**`)
                .setTimestamp();

            await safeSendMessage(logChannel, { embeds: [voidPassedEmbed] });
        }

        const confirmationEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription(`Game #${game.game_number} will be voided and all game-related channels will be deleted in 60 seconds.`)
            .setTimestamp();

        const channel = await guild.channels.fetch(game.text_channel_id).catch(() => null);
        if (channel) {
            await safeSendMessage(channel, { embeds: [confirmationEmbed] });
        }

        await new Promise(resolve => setTimeout(resolve, 60000));

        // Move players to waiting room
        const waitingRoomId = config.waitingChannel;
        if (waitingRoomId) {
            const waitingRoom = await guild.channels.fetch(waitingRoomId);
            if (waitingRoom) {
                const category = await guild.channels.fetch(game.category_id);
                if (category) {
                    const voiceChannels = category.children.cache.filter(channel => channel.type === 2);
                    for (const [, channel] of voiceChannels) {
                        for (const [, member] of channel.members) {
                            try {
                                await member.voice.setChannel(waitingRoom);
                            } catch (error) {
                                console.error('Error moving member to waiting room:', error);
                            }
                        }
                    }
                }
            }
        }

        // Delete game channels
        try {
            const category = await guild.channels.fetch(game.category_id);
            if (category) {
                for (const [, channel] of category.children.cache) {
                    await safeDeleteChannel(channel);
                }
                await safeDeleteChannel(category);
            }
        } catch (error) {
            console.error('Error deleting game channels:', error);
        }

        // Send final void message
        if (logChannel) {
            const finalLogEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`**Game** \`#${game.game_number}\` **voided!**`)
                .setTimestamp();

            await safeSendMessage(logChannel, { embeds: [finalLogEmbed] });
        }
    } catch (error) {
        console.error('Error in voidGame:', error);
    }
}