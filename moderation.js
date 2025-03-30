const { addRecentMessage, getRecentMessages } = require('./database');

/**
 * Check if a link in a message is allowed
 * @param {string} content - The message content
 * @returns {boolean} Whether the link is allowed
 */
function isLinkAllowed(content) {
    // Load allowed domains from config
    const { allowedLinks } = require('../config.json');
    
    // Simple URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlPattern);
    
    if (!matches) return true; // No URLs found
    
    // Check each URL against allowed domains
    for (const url of matches) {
        let isAllowed = false;
        
        for (const allowedDomain of allowedLinks) {
            if (url.includes(allowedDomain)) {
                isAllowed = true;
                break;
            }
        }
        
        if (!isAllowed) {
            return false; // Found a disallowed URL
        }
    }
    
    return true; // All URLs are allowed
}

/**
 * Check if a message might be part of a raid
 * @param {Object} message - The Discord message object
 * @returns {Promise<boolean>} Whether the message might be part of a raid
 */
async function isRaidMessage(message) {
    // Add message to recent messages for tracking
    addRecentMessage(message);
    
    // Get recent messages for this guild
    const recentMessages = getRecentMessages(message.guild.id);
    
    // If there aren't many messages, it's not a raid
    if (recentMessages.length < 10) return false;
    
    // Check for message rate (more than 10 messages in 5 seconds from the same user)
    const userMessageCount = recentMessages.filter(
        msg => msg.userId === message.author.id && 
        (Date.now() - msg.timestamp) < 5000
    ).length;
    
    if (userMessageCount >= 5) {
        return true;
    }
    
    // Check for message similarity (same content posted multiple times)
    const similarMessages = recentMessages.filter(
        msg => msg.content === message.content && 
        (Date.now() - msg.timestamp) < 10000
    ).length;
    
    if (similarMessages >= 3) {
        return true;
    }
    
    // Check for multiple users posting the same message (coordinated raid)
    const uniqueUsers = new Set(
        recentMessages
            .filter(msg => msg.content === message.content && (Date.now() - msg.timestamp) < 10000)
            .map(msg => msg.userId)
    );
    
    if (uniqueUsers.size >= 3) {
        return true;
    }
    
    return false;
}

module.exports = {
    isLinkAllowed,
    isRaidMessage
};
