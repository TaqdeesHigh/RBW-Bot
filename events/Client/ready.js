const {Client, ModalBuilder, Activity, ActivityType} = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        client.user.setPresence({
            activities: [{ 
                name: 'Zomire', 
                type: ActivityType.Playing 
            }],
            status: 'dnd'
        });
       
        console.log('Connected to discord')
    }
}