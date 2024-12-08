const { query } = require('../../database');
const config = require('../../config.json');
const { updatePlayerRoles, getRankForElo } = require('../../eloCalc');

async function updateNickname(member, elo, mcUsername) {
    try {
        if (member.guild.members.me.permissions.has('ManageNicknames') &&
            member.manageable) {
            await member.setNickname(`${elo} - ${mcUsername}`);
        }
    } catch (error) {
        console.error(`Failed to update nickname for ${member.user.tag}:`, error);
    }
}

async function updateEloAndNickname(userId, guild, eloChange = 0) {
    try {
        const userStats = await query('stats', 'findOne', { discord_id: userId });
        const userRegistered = await query('registered', 'findOne', { discord_id: userId });

        if (!userStats || !userRegistered) {
            console.error(`User ${userId} not found in database`);
            return;
        }

        const newElo = Math.max(0, userStats.elo + eloChange);
        const newRank = getRankForElo(newElo);

        // Update both ELO and rank in the database
        await query('stats', 'updateOne', 
            { discord_id: userId },
            { $set: { 
                elo: newElo,
                rank: newRank
            }}
        );

        const member = await guild.members.fetch(userId);
        
        // Update nickname
        await updateNickname(member, newElo, userRegistered.mc_user);
        
        // Update roles
        await updatePlayerRoles(userId, newRank, guild.id, guild.client);

        console.log(`Updated ELO, rank, and nickname for ${userRegistered.mc_user} (${userId}): ${userStats.elo} -> ${newElo}, Rank: ${newRank}`);
    } catch (error) {
        console.error(`Error updating ELO and nickname for ${userId}:`, error);
    }
}

module.exports = { updateEloAndNickname };