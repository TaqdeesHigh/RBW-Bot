# RBW Discord Bot

A comprehensive Discord bot for managing ranked bedwars matches with auto-queuing functionality, team selection, and extensive stat tracking.

## Features

### Queue Management
- Automatic queuing system 
- Multiple game modes (2v2, 3v3, 4v4 ranked)
- Team selection methods:
 - Random assignment
 - Manual team choosing

### Commands

#### Player Commands
- `/leaderboard` - View rankings by elo, bedbreaks, wins, losses, and WLR
- `/register` - Register as a player
- `/stats` - Check your statistics 
- `/submit` - Submit game results
- `/unregister` - Remove yourself from the system
- `/void` - Void an ongoing game

#### Admin Commands
- `/ban` - Restrict players from queuing
- `/elo`
 - `add` - Add elo points
 - `remove` - Remove elo points
 - `fix` - Verify and correct elo calculations
- `/force_register` - Manually register users
- `/force_unregister` - Manually unregister users
- `/fv` (force void) - Administratively void games
- `/score` - Record game scores
- `/strike`
 - `give` - Issue strikes
 - `remove` - Remove strikes
 - `edit` - Modify strikes
- `/unban` - Remove queue restrictions
- `/updateGamemodeChannels` - Set up required queuing channels

## Installation

1. Clone the repository
2. Configure the bot settings

### Configuration Setup

1. Rename `dev.env` to `.env` and fill in the following:
```
env
TOKEN="your_discord_bot_token"
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=your_database_port
```

2. Edit `config.json` with your server details:
```
{
    "guildId": "yourGuildID",
    "logsChannel": "yourChannelID", 
    "GAME_LOGS": "yourChannelID",
    "waitingChannel": "yourChannelID",
    "ssChannel": "yourChannelID",
    "scoreChannelID": "yourChannelID",
    "alertID": "yourChannelID",
   "devs": ["378606584802050049", "1185618985518116925"]
}
```

**Important**: Do not remove or modify the "devs" field as it credits the original developers.

### Dependencies Installation

Install required packages using npm:

`npm install`

Or install individual packages:

`npm install @napi-rs/canvas ascii-table axios canvas discord-html-transcripts discord-hybrid-sharding discord.js dotenv fs ms mysql mysql2`

### Running the Bot

1. Start the bot using:

`node cluster.js`

2. Successful initialization will display:

```
Launched Cluster 0
Database initialized
Logged in as {Bot-Name}
.-------------------------------.
|        Events        | Status |
|----------------------|--------|
| buttonInteraction.js | ✅      |
| ready.js             | ✅      |
| updateNickName.js    | ✅      |
| guildCreate.js       | ✅      |
| interactionCreate.js | ✅      |
| unbanJob.js          | ✅      |
| gameLogger.js        | ✅      |
| ChooseTeams.js       | ✅      |
| RandomTeam.js        | ✅      |
| voiceStateUpdate.js  | ✅      |
| banned.js            | ✅      |
| warning.js           | ✅      |
'-------------------------------'
Loaded events
.------------------------------------.
|         Commands          | Status |
|---------------------------|--------|
| ban.js                    | ✅      |
| Elo.js                    | ✅      |
| fix.js                    | ✅      |
| forceRegister.js          | ✅      |
| forceUnregister.js        | ✅      |
| fv.js                     | ✅      |
| score.js                  | ✅      |
| strike.js                 | ✅      |
| unban.js                  | ✅      |
| updateGamemodeChannels.js | ✅      |
| leaderboard.js            | ✅      |
| register.js               | ✅      |
| ss.js                     | ✅      |
| stats.js                  | ✅      |
| submit.js                 | ✅      |
| test.js                   | ✅      |
| unregister.js             | ✅      |
| void.js                   | ✅      |
'------------------------------------'
Loaded Commands
Bot is ready!
```

### Contributing
Contributions are welcome! Please feel free to submit pull requests or report issues.

### Credits

Originally developed by:

- Discord ID: 378606584802050049
- Discord ID: 1185618985518116925

### Enojoy!