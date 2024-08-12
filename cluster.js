// Typescript: import { ClusterManager } from 'discord-hybrid-sharding'
const { ClusterManager } = require('discord-hybrid-sharding'),
{ token } = require('./config.json');


const manager = new ClusterManager(`${__dirname}/index.js`, {
    totalShards: 2, // or 'auto'
    /// Check below for more options
    shardsPerClusters: 2,
    // totalClusters: 7,
    mode: 'process', // you can also choose "worker"
    token: token,
});

manager.on('clusterCreate', cluster => console.log(`Launched Cluster ${cluster.id}`));
manager.spawn({ timeout: -1 });