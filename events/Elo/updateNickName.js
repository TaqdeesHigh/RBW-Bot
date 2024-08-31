const { query } = require('../../database');
const config = require('../../config.json');

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

        await query('stats', 'updateOne', 
            { discord_id: userId },
            { $set: { elo: newElo } }
        );

        const member = await guild.members.fetch(userId);
        await updateNickname(member, newElo, userRegistered.mc_user);

        console.log(`Updated ELO and nickname for ${userRegistered.mc_user} (${userId}): ${userStats.elo} -> ${newElo}`);
    } catch (error) {
        console.error(`Error updating ELO and nickname for ${userId}:`, error);
    }
}

module.exports = { updateEloAndNickname };