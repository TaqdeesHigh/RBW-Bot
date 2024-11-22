const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('void')
        .setDescription('Start a vote to void the current game'),

    async execute(interaction) {
        const channelName = interaction.channel.name;
        const gameNumber = channelName.split('-')[1];

        if (!gameNumber) {
            return await interaction.reply({ content: 'This command can only be used in game channels!', ephemeral: true });
        }

        const game = await query('games', 'findOne', { game_number: gameNumber });
        if (!game) {
            return await interaction.reply({ content: 'No active game found in this channel!', ephemeral: true });
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

            // Update button labels with vote counts
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
        
            const logChannel = interaction.client.channels.cache.get(config.logsChannel);
        
            if (proceedCount > cancelCount) {
                if (logChannel) {
                    const voidPassedEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`**Game** \`#${gameNumber}\` **void vote passed**`)
                        .setTimestamp();
        
                    await logChannel.send({ embeds: [voidPassedEmbed] });
                }
        
                await voteMessage.edit({ 
                    content: null,
                    embeds: [], 
                    components: [] 
                });
        
                await new Promise(resolve => setTimeout(resolve, 60000));
                await voidGame(interaction.guild, game, logChannel);
            } else {
                await voteMessage.edit({ 
                    content: null,
                    embeds: [], 
                    components: [] 
                });
            }
        });
        
        async function voidGame(guild, game, logChannel) {
            // Get waiting room channel ID from database and move players
            const guildSettings = await query('others', 'findOne', { guild_id: guild.id });
            const waitingRoomId = guildSettings?.waiting_room;
        
            if (waitingRoomId) {
                const waitingRoom = await guild.channels.fetch(waitingRoomId);
                if (waitingRoom) {
                    const category = await guild.channels.fetch(game.category_id);
                    if (category) {
                        const voiceChannels = category.children.cache.filter(channel => channel.type === 2);
                        for (const [, channel] of voiceChannels) {
                            for (const [, member] of channel.members) {
                                await member.voice.setChannel(waitingRoom).catch(console.error);
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
                        await channel.delete();
                    }
                    await category.delete();
                }
            } catch (error) {
                console.error('Error deleting game channels:', error);
            }
        
            // Update game status in database
            await query('games', 'updateOne', 
                { game_number: game.game_number },
                { $set: { status: 'voided' }}
            );
        
            // Send final void message
            if (logChannel) {
                const finalLogEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription(`**Game** \`#${game.game_number}\` **voided!**`)
                    .setTimestamp();
        
                await logChannel.send({ embeds: [finalLogEmbed] });
            }
        }
    }
}