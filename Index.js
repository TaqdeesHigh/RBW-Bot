const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const errorHandler = require('./handlers/errorHandler');
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    await errorHandler.handleCommandError(interaction, error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  errorHandler.logError(reason instanceof Error ? reason : new Error(String(reason)), { context: 'Unhandled Rejection' });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  errorHandler.logError(error, { context: 'Uncaught Exception' });
  // Gracefully shut down the bot
  client.destroy();
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('Bot is shutting down...');
  await errorHandler.logError(new Error('Bot shutdown initiated'), { context: 'Graceful Shutdown' });
  client.destroy();
  process.exit(0);
});

initializeBot();