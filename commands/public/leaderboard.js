const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query } = require('../../database');
const Canvas = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View various leaderboards')
        .addSubcommand(subcommand => 
            subcommand
                .setName('elo')
                .setDescription('Top players by Elo rating'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('bedbreak')
                .setDescription('Top bed breakers'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('wins')
                .setDescription('Top players by wins'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('lost')
                .setDescription('Top players by lost games'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('wlr')
                .setDescription('Top players by Win/Loss Ratio')),

    async execute(interaction) {
        // Defer the reply to handle potentially slow database queries
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        
        // Determine the sorting column and order based on the subcommand
        let orderBy, title, valueKey, formatValue, statLabel;
        switch (subcommand) {
            case 'elo':
                orderBy = 'COALESCE(stats.elo, 0) DESC';
                title = 'Elo Leaderboard';
                valueKey = 'elo';
                formatValue = (val) => Math.round(val);
                statLabel = 'Elo Rating';
                break;
            case 'bedbreak':
                orderBy = 'COALESCE(stats.bed_breaker, 0) DESC';
                title = 'Bed Breakers Leaderboard';
                valueKey = 'bed_breaker';
                formatValue = (val) => Math.round(val);
                statLabel = 'Bed Breaks';
                break;
            case 'wins':
                orderBy = 'COALESCE(stats.wins, 0) DESC';
                title = 'Wins Leaderboard';
                valueKey = 'wins';
                formatValue = (val) => Math.round(val);
                statLabel = 'Total Wins';
                break;
            case 'lost':
                orderBy = 'COALESCE(stats.lost, 0) DESC';
                title = 'Lost Games Leaderboard';
                valueKey = 'lost';
                formatValue = (val) => Math.round(val);
                statLabel = 'Total Losses';
                break;
            case 'wlr':
                orderBy = 'COALESCE(stats.wlr, 0) DESC';
                title = 'Win/Loss Ratio Leaderboard';
                valueKey = 'wlr';
                formatValue = (val) => val.toFixed(2);
                statLabel = 'W/L Ratio';
                break;
            default:
                return interaction.editReply('Invalid leaderboard type');
        }

        try {
            // Fetch all registered players with their stats
            const rows = await query('registered', 'select', `
                SELECT 
                    r.mc_user, 
                    r.discord_id, 
                    COALESCE(s.${valueKey}, 0) as stat_value,
                    s.${valueKey} as actual_stat_value
                FROM 
                    registered r
                LEFT JOIN 
                    stats s ON r.discord_id = s.discord_id
                ORDER BY 
                    stat_value DESC
            `);

            // Pagination setup
            const itemsPerPage = 5;
            const totalPages = Math.ceil(rows.length / itemsPerPage);

            // Function to create leaderboard image for a specific page
            async function createLeaderboardImage(page) {
                // Resolve background image path
                const backgroundPath = path.resolve(__dirname, '../../Assets/Images/StatsBG.png');
                
                // Check if background image exists
                if (!fs.existsSync(backgroundPath)) {
                    console.error('Background image not found:', backgroundPath);
                    throw new Error('Background image not found');
                }

                // Load background image
                const background = await Canvas.loadImage(backgroundPath);

                // Create canvas
                const canvas = Canvas.createCanvas(1000, Math.min(1000, itemsPerPage * 100 + 200));
                const ctx = canvas.getContext('2d');

                // Draw background image with blur
                ctx.filter = 'blur(50px)';
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none'; // Reset filter

                // Title with page number and leaderboard type
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${title} - Page ${page + 1}/${totalPages}`, canvas.width / 2, 70);

                // Table headers
                ctx.font = '30px Arial';
                ctx.fillStyle = '#7289DA';
                ctx.textAlign = 'left';
                ctx.fillText('Rank', 50, 130);
                ctx.fillText('Username', 200, 130);
                ctx.textAlign = 'right';
                ctx.fillText(statLabel, canvas.width - 50, 130);

                // Horizontal line
                ctx.beginPath();
                ctx.strokeStyle = '#7289DA';
                ctx.lineWidth = 2;
                ctx.moveTo(25, 150);
                ctx.lineTo(canvas.width - 25, 150);
                ctx.stroke();

                // Slice rows for current page
                const pageRows = rows.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

                // Populate leaderboard
                pageRows.forEach((entry, index) => {
                    const y = 200 + index * 100;
                    const globalRank = page * itemsPerPage + index + 1;
                    
                    // Rank
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '25px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${globalRank}`, 50, y);

                    // Username
                    ctx.fillText(entry.mc_user, 200, y);

                    // Stat Value - use the actual stat value, not the coalesced one
                    ctx.textAlign = 'right';
                    ctx.fillText(formatValue(entry.actual_stat_value || 0), canvas.width - 50, y);

                    // Separation line
                    ctx.beginPath();
                    ctx.strokeStyle = '#484C52';
                    ctx.lineWidth = 1;
                    ctx.moveTo(25, y + 20);
                    ctx.lineTo(canvas.width - 25, y + 20);
                    ctx.stroke();
                });

                return canvas.toBuffer('image/png');
            }

            // Create buttons
            const createButtons = (page) => {
                const row = new ActionRowBuilder();
                
                // Previous button
                if (page > 0) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_prev_${subcommand}`)
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                // Next button
                if (page < totalPages - 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_next_${subcommand}`)
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                return row;
            };

            // Initial page
            let currentPage = 0;

            // Initial image
            const initialImage = await createLeaderboardImage(currentPage);

            // Send initial response
            let message;
            if (totalPages > 1) {
                const initialButtons = createButtons(currentPage);
                message = await interaction.editReply({ 
                    files: [new AttachmentBuilder(initialImage, { name: 'leaderboard.png' })],
                    components: [initialButtons]
                });
            } else {
                message = await interaction.editReply({ 
                    files: [new AttachmentBuilder(initialImage, { name: 'leaderboard.png' })]
                });
            }

            // Create collector for button interactions
            const collector = message.createMessageComponentCollector({ 
                time: 5 * 60 * 1000 // 5 minutes
            });

            collector.on('collect', async (interaction) => {
                // Ensure the interaction is from the original user
                if (interaction.user.id !== interaction.user.id) {
                    await interaction.reply({ 
                        content: 'You cannot control this leaderboard.', 
                        ephemeral: true 
                    });
                    return;
                }

                // Handle pagination
                if (interaction.customId === `leaderboard_next_${subcommand}`) {
                    currentPage = Math.min(currentPage + 1, totalPages - 1);
                } else if (interaction.customId === `leaderboard_prev_${subcommand}`) {
                    currentPage = Math.max(currentPage - 1, 0);
                }

                // Update image and buttons
                const newImage = await createLeaderboardImage(currentPage);

                // Update the message
                if (totalPages > 1) {
                    const newButtons = createButtons(currentPage);
                    await interaction.update({ 
                        files: [new AttachmentBuilder(newImage, { name: 'leaderboard.png' })],
                        components: [newButtons]
                    });
                } else {
                    await interaction.update({ 
                        files: [new AttachmentBuilder(newImage, { name: 'leaderboard.png' })],
                        components: []
                    });
                }
            });

            collector.on('end', async () => {
                // Disable buttons after time expires
                await interaction.editReply({ 
                    components: [] 
                });
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.editReply('An error occurred while fetching the leaderboard.');
        }
    }
};