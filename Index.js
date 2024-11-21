const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const errorHandler = require('./handlers/errorHandler');
const { checkAndRemoveBans } = require('./events/jobs/unbanJob');

require("dotenv").config();

const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;

const { loadEvents } = require("./handlers/eventHandler");
const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates],
  partials: [User, Message, GuildMember, ThreadMember],
});

client.commands = new Collection();
client.cluster = new ClusterClient(client);

setInterval(() => {
  checkAndRemoveBans(client);
}, 60000);

async function initializeBot() {
  try {
    await client.login(process.env.token);
    await loadEvents(client);
    await loadCommands(client);
    console.log('Bot is ready!');
    await errorHandler.initializeLogFile();
  } catch (error) {
    console.error('Failed to initialize bot:', error);
    errorHandler.logError(error, { context: 'Bot Initialization' });
    process.exit(1);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

initializeBot();