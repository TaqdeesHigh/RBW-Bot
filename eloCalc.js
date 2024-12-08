const config = require('./config.json');
const { query } = require('./database');

function getRankForElo(elo) {
    const thresholds = Object.keys(config.ranks).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
        if (elo >= threshold) {
            let rawRank = config.ranks[threshold];
            return formatRankName(rawRank);
        }
    }
    return formatRankName(config.ranks[0]);
}

function getEloDataForRank(rank) {
    if (!config.eloData[rank]) {
        console.warn(`Rank ${rank} not found in eloData config, using default values`);
        return {
            win: 15,
            loss: 10,
            draw: 5
        };
    }
    return config.eloData[rank];
}

function formatRankName(rankName) {
    const [tier, number] = rankName.match(/([a-zA-Z]+)(\d)/).slice(1);
    const capitalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1);
    const romanNumerals = {
        '1': 'I',
        '2': 'II',
        '3': 'III'
    };
    return `${capitalizedTier} ${romanNumerals[number]}`;
}

async function updatePlayerStats(playerId, eloChange, winIncrement, lossIncrement, guildId, client) {
    const player = await query('stats', 'findOne', { discord_id: playerId });
    
    if (!player) {
        console.error(`Player with discord_id ${playerId} not found`);
        return;
    }

    let newElo = Math.max(0, player.elo + eloChange);
    let newRank = getRankForElo(newElo);

    await query('stats', 'updateOne', 
        { discord_id: playerId },
        { 
            $set: { 
                elo: newElo, 
                rank: newRank
            },
            $inc: { 
                wins: winIncrement, 
                losses: lossIncrement
            }
        }
    );

    if (newRank !== player.rank) {
        await updatePlayerRoles(playerId, newRank, guildId, client);
    }

    return { oldElo: player.elo, newElo, oldRank: player.rank, newRank };
}

async function updatePlayerRoles(playerId, newRank, guildId, client) {
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            console.error(`Guild ${guildId} not found`);
            return;
        }

        const member = await guild.members.fetch(playerId);
        if (!member) {
            console.error(`Member ${playerId} not found in guild ${guildId}`);
            return;
        }

        const rankRoles = await query(null, 'raw', 'SELECT * FROM rank_roles WHERE guild_id = ?', [guildId]);
        
        for (const rankRole of rankRoles) {
            const role = guild.roles.cache.get(rankRole.role_id);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        }

        const newRankRole = rankRoles.find(r => r.display_name === newRank);
        if (newRankRole) {
            const role = guild.roles.cache.get(newRankRole.role_id);
            if (role) {
                await member.roles.add(role);
                console.log(`Updated role for ${member.user.tag} to ${newRank}`);
            } else {
                console.error(`Role not found for rank ${newRank}`);
            }
        } else {
            console.error(`Role data not found for rank ${newRank}`);
        }
    } catch (error) {
        console.error('Error updating player roles:', error);
    }
}

function convertRankToConfigFormat(displayRank) {
    if (!displayRank) return 'bronze1';
    
    const [tier, numeral] = displayRank.split(' ');
    
    const romanToNumber = {
        'I': '1',
        'II': '2',
        'III': '3'
    };
    
    return `${tier.toLowerCase()}${romanToNumber[numeral]}`;
}

async function eloCalc(winningTeam, losingTeam, mvp, guildId, client) {
    const results = {
        winners: [],
        losers: [],
        mvp: null
    };

    for (const winner of winningTeam) {
        try {
            const player = await query('stats', 'findOne', { discord_id: winner });
            if (player) {
                const configRank = convertRankToConfigFormat(player.rank);
                const eloData = getEloDataForRank(configRank);
                const result = await updatePlayerStats(winner, eloData.win, 1, 0, guildId, client);
                results.winners.push({ ...result, discord_id: winner });
            }
        } catch (error) {
            console.error(`Error processing winner ${winner}:`, error);
        }
    }

    for (const loser of losingTeam) {
        try {
            const player = await query('stats', 'findOne', { discord_id: loser });
            if (player) {
                const configRank = convertRankToConfigFormat(player.rank);
                const eloData = getEloDataForRank(configRank);
                const eloLoss = player.elo > 0 ? eloData.loss : 0;
                const result = await updatePlayerStats(loser, -eloLoss, 0, 1, guildId, client);
                results.losers.push({ ...result, discord_id: loser });
            }
        } catch (error) {
            console.error(`Error processing loser ${loser}:`, error);
        }
    }

    if (mvp) {
        try {
            const result = await updatePlayerStats(mvp, 5, 0, 0, guildId, client);
            results.mvp = { ...result, discord_id: mvp };
        } catch (error) {
            console.error(`Error processing MVP ${mvp}:`, error);
        }
    }

    return results;
}

async function createRankRoles(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        await interaction.editReply('Deleting existing rank roles...');
        
        const existingRoles = await query(null, 'raw', 'SELECT * FROM rank_roles WHERE guild_id = ?', [guild.id]);
        
        for (const roleData of existingRoles) {
            const role = guild.roles.cache.get(roleData.role_id);
            if (role) {
                await role.delete().catch(console.error);
            }
        }
        
        await query(null, 'raw', 'DELETE FROM rank_roles WHERE guild_id = ?', [guild.id]);
        
        await interaction.editReply('Existing roles deleted. Creating new roles...');

        const ranks = Object.values(config.ranks).map(rank => {
            const [tier, number] = rank.match(/([a-zA-Z]+)(\d)/).slice(1);
            const romanNumerals = { '1': 'I', '2': 'II', '3': 'III' };
            return {
                configName: rank,
                displayName: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${romanNumerals[number]}`
            };
        });

        const rankOrder = [
            'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald',
            'Sapphire', 'Ruby', 'Crystal', 'Opal', 'Amethyst', 'Obsidian',
            'Veteran', 'Quartz', 'Topaz', 'Netherite'
        ].reverse();

        ranks.sort((a, b) => {
            const rankA = rankOrder.indexOf(a.displayName.split(' ')[0]);
            const rankB = rankOrder.indexOf(b.displayName.split(' ')[0]);
            if (rankA === rankB) {
                return b.displayName.endsWith('III') ? 1 : b.displayName.endsWith('I') ? -1 : 0;
            }
            return rankB - rankA;
        });

        const tierColors = {
            'Bronze': '#cd7f32',
            'Silver': '#c0c0c0',
            'Gold': '#ffd700',
            'Platinum': '#e5e4e2',
            'Diamond': '#b9f2ff',
            'Emerald': '#50c878',
            'Sapphire': '#0f52ba',
            'Ruby': '#e0115f',
            'Crystal': '#a7d8de',
            'Opal': '#a8c3bc',
            'Amethyst': '#9966cc',
            'Obsidian': '#3d3d3d',
            'Veteran': '#b80000',
            'Quartz': '#ffccf9',
            'Topaz': '#ffc87c',
            'Netherite': '#4a4a4a'
        };

        let created = 0;
        
        for (let i = ranks.length - 1; i >= 0; i--) {
            const rank = ranks[i];
            const tier = rank.displayName.split(' ')[0];
            const color = tierColors[tier] || '#99aab5';
            
            const role = await guild.roles.create({
                name: rank.displayName,
                color: color,
                position: 1,
                reason: 'Automated rank role creation'
            });
            
            created++;

            await query(null, 'raw', `
                INSERT INTO rank_roles 
                (guild_id, rank_name, role_id, display_name, position) 
                VALUES (?, ?, ?, ?, ?)
            `, [guild.id, rank.configName, role.id, rank.displayName, i]);
        }

        await interaction.editReply(
            `Rank roles update complete!\n` +
            `Deleted all existing rank roles\n` +
            `Created ${created} new roles\n` +
            `All roles have been saved to the database.`
        );

    } catch (error) {
        console.error('Error creating rank roles:', error);
        await interaction.editReply('An error occurred while creating rank roles. Please check the console for details.');
    }
}

module.exports = { 
    eloCalc,
    getRankForElo,
    createRankRoles,
    updatePlayerRoles
};