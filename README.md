# RBW Discord Bot

A comprehensive Discord bot for managing ranked bedwars matches with auto-queuing functionality, team selection, and extensive stat tracking.

## Features

### Queue Management
- Automatic queuing system 
- Multiple game modes (2v2, 3v3, 4v4 ranked)
- Team selection methods:
 - Random assignment
 - Manual team choosing

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
| All events           |   ✅   |
'-------------------------------'
Loaded events
.------------------------------------.
|         Commands          | Status |
|---------------------------|--------|
| All Commands              |   ✅   |
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
