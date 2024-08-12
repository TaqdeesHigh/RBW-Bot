const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const { Client, GatewayIntentBits, Partials, Collection, Embed, EmbedBuilder } = require("discord.js");
const env = require("dotenv").config();

const { Guilds, GuildMembers, GuildMessages, MessageContent } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;

const { loadEvents } = require("./handlers/eventHandler");
const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent],
  Partials: [User, Message, GuildMember, ThreadMember],
});

client.commands = new Collection();

client.cluster = new ClusterClient(client);

client.login(process.env.token).then(() => {
  loadEvents(client);
  loadCommands(client);
});

