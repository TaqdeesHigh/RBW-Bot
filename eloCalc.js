const eloData = require('./config.json').eloData;
const rank = require('./config.json').ranks;
const mysql = require('mysql');


function getRankForElo(elo, ranks) { //Don't worry about this function, it's just to get the rank for the elo
    let previousThreshold = 0;
    const thresholds = Object.keys(ranks).map(Number).sort((a, b) => a - b);

    for (const threshold of thresholds) {
        if (elo < threshold) {
            return ranks[previousThreshold];
        }
        previousThreshold = threshold;
    }

    return ranks[previousThreshold]; 
}



async function eloCalc (winningTeam, losingTeam, mvp) { // winningTeam and losingTeam are arrays of discord IDs, mvp is a singular discord id
    const db = mysql.createPool({
        host: "localhost",
        user: 'root',
        password: '',
        database: 'rbwbot'
    })

    winningTeam.forEach(winner => {
        db.query(`SELECT * FROM stats WHERE discord_id = ${winner}`, (err, result) => { // Get the winner's stats
            if (err) throw err;
            
            let winnerElo = result[0].elo;
            let winnerWins = result[0].wins;
            let winnerRank = getRankForElo(winnerElo, rank);

            let winnerEloChange = eloData[winnerRank].win;

            db.query(`UPDATE stats SET elo = ${winnerElo + winnerEloChange}, wins = ${winnerWins + 1} WHERE discord_id = ${winner}`, (err, result) => {
                if (err) throw err;
            })
            
        })
    })

    losingTeam.forEach(loser => {
        db.query(`SELECT * FROM stats WHERE discord_id = ${loser}`, (err, result) => { // Get the loser's stats
            if (err) throw err;
            
            let loserElo = result[0].elo;

            

            let loserLosses = result[0].losses;
            let loserRank = getRankForElo(loserElo, rank);

            let loserEloChange = eloData[loserRank].loss;

            if (loserElo - loserEloChange < 0) {
                loserElo = 0;
                loserEloChange = 0;
            }

            db.query(`UPDATE stats SET elo = ${loserElo - loserEloChange}, losses = ${loserLosses + 1} WHERE discord_id = ${loser}`, (err, result) => {
                if (err) throw err;
            })
            
        })
    })

    db.query(`SELECT * FROM stats WHERE discord_id = ${mvp}`, (err, result) => { // Get the MVP's stats
        if (err) throw err;
        const mvpElo = result[0].elo;
               db.query(`UPDATE stats SET elo = ${mvpElo + 5} WHERE discord_id = ${mvp}`, (err, result) => {
            if (err) throw err;
        })
        
    })
}



module.exports = { eloCalc };