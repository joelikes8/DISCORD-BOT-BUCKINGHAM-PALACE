const { Events } = require('discord.js');
const { isLinkAllowed, isRaidMessage } = require('../utils/moderation');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Ignore DM messages
        if (!message.guild) return;
        
        try {
            // Check if the message contains disallowed links
            if (message.content.includes('http://') || message.content.includes('https://')) {
                if (!isLinkAllowed(message.content)) {
                    // Delete message with disallowed link
                    await message.delete();
                    
                    // Warn the user
                    await message.author.send({
                        content: 'Your message contained a disallowed link. Only links from Roblox.com and Google Docs are allowed in this server.'
                    }).catch(error => {
                        console.error('Failed to send DM to user:', error);
                    });
                    
                    return;
                }
            }
            
            // Check if the message is part of a raid
            if (await isRaidMessage(message)) {
                // Delete raid message
                await message.delete();
                
                // Consider taking action against the user
                const member = message.guild.members.cache.get(message.author.id);
                if (member && member.kickable) {
                    await member.kick('Automatic action: Raid detection');
                }
                
                return;
            }
            
        } catch (error) {
            console.error('Error in messageCreate event:', error);
        }
    },
};
