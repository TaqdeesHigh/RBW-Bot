const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fv')
        .setDescription('Force void the current game (Admin only)'),

    async execute(interaction) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: 'This command can only be used by administrators!', ephemeral: true });
        }

        // Check if the channel is a game channel
        const channelName = interaction.channel.name;
        const gameNumber = channelName.split('-')[1];

        if (!gameNumber) {
            return await interaction.reply({ content: 'This command can only be used in game channels!', ephemeral: true });
        }

        // Check if game exists
        const game = await query('games', 'findOne', { game_number: gameNumber });
        if (!game) {
            return await interaction.reply({ content: 'No active game found in this channel!', ephemeral: true });
        }

        // Log the force void
        const logChannel = interaction.client.channels.cache.get(config.logsChannel);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`
**Game** \`#${gameNumber}\` **has been force voided!**
**Admin:** ${interaction.user.tag}
**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                .setFooter({ 
                    text: `Force Void by Admin`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                });

            await logChannel.send({ embeds: [logEmbed] });
        }

        await interaction.reply('Game will be force voided in 60 seconds. All players will be moved to the waiting room.');

        // Wait 60 seconds
        await new Promise(resolve => setTimeout(resolve, 60000));

        // Get waiting room channel ID from database
        const guildSettings = await query('others', 'findOne', { guild_id: interaction.guild.id });
        const waitingRoomId = guildSettings?.waiting_room;

        // Move all members to waiting room if it exists
        if (waitingRoomId) {
            const waitingRoom = await interaction.guild.channels.fetch(waitingRoomId);
            if (waitingRoom) {
                const category = await interaction.guild.channels.fetch(game.category_id);
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
            const category = await interaction.guild.channels.fetch(game.category_id);
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

        // Send final message in log channel
        if (logChannel) {
            const finalLogEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription(`
**Game** \`#${gameNumber}\` **void process completed**
**Channels deleted**
**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                .setFooter({ 
                    text: `Game Force Voided.`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                });

            await logChannel.send({ embeds: [finalLogEmbed] });
        }
    }
};