const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Set the bot's activity
        client.user.setActivity('Buckingham Palace | /verify', { type: 'WATCHING' });
    },
};
