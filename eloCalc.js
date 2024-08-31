const config = require('./config.json');
const { query } = require('./database');

function getRankForElo(elo) {
    const thresholds = Object.keys(config.ranks).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
        if (elo >= threshold) {
            return config.ranks[threshold];
        }
    }
    return config.ranks[0]; // Default to lowest rank
}

function getEloDataForRank(rank) {
    return config.eloData[rank];
}

async function updatePlayerStats(playerId, eloChange, winIncrement, lossIncrement) {
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

    return { oldElo: player.elo, newElo, oldRank: player.rank, newRank };
}

async function eloCalc(winningTeam, losingTeam, mvp) {
    const results = {
        winners: [],
        losers: [],
        mvp: null
    };

    for (const winner of winningTeam) {
        const player = await query('stats', 'findOne', { discord_id: winner });
        if (player) {
            const eloData = getEloDataForRank(player.rank);
            const result = await updatePlayerStats(winner, eloData.win, 1, 0);
            results.winners.push({ ...result, discord_id: winner });
        }
    }

    for (const loser of losingTeam) {
        const player = await query('stats', 'findOne', { discord_id: loser });
        if (player) {
            const eloData = getEloDataForRank(player.rank);
            const eloLoss = player.elo > 0 ? eloData.loss : 0;
            const result = await updatePlayerStats(loser, -eloLoss, 0, 1);
            results.losers.push({ ...result, discord_id: loser });
        }
    }

    if (mvp) {
        const result = await updatePlayerStats(mvp, 5, 0, 0);
        results.mvp = { ...result, discord_id: mvp };
    }

    return results;
}

// Function to update all players' ranks based on current config
async function updateAllPlayerRanks() {
    const allPlayers = await query('stats', 'find', {});
    for (const player of allPlayers) {
        const newRank = getRankForElo(player.elo);
        if (newRank !== player.rank) {
            await query('stats', 'updateOne', 
                { discord_id: player.discord_id },
                { $set: { rank: newRank } }
            );
            console.log(`Updated ${player.discord_id}'s rank from ${player.rank} to ${newRank}`);
        }
    }
}

module.exports = { eloCalc, updateAllPlayerRanks };