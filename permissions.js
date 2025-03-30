const { PermissionFlagsBits } = require('discord.js');

/**
 * Check if a user is a moderator or has higher privileges
 * @param {Object} member - The guild member to check
 * @returns {boolean} - Whether the user is a moderator or above
 */
function isModeratorOrAbove(member) {
    if (!member) return false;
    
    // Check for administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    
    // Check for moderator permissions
    if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
    
    // Check for ban/kick permissions which are typically given to moderators
    if (member.permissions.has(PermissionFlagsBits.BanMembers) || 
        member.permissions.has(PermissionFlagsBits.KickMembers)) return true;
    
    // Check for moderator role by name
    return member.roles.cache.some(role => 
        role.name.toLowerCase().includes('mod') || 
        role.name.toLowerCase().includes('admin')
    );
}

module.exports = {
    isModeratorOrAbove
};