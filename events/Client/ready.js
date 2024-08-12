const {Client, ModalBuilder, Activity, ActivityType} = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute (client) {

       setInterval(activity => {
        client.user.setActivity({
            name:'Test',
            type: ActivityType.Watching,
        })
      }, 3600)
       
        console.log('Connected to discord')
    }
}