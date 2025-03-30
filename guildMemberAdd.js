const { Events, EmbedBuilder } = require('discord.js');
const { getGuildSettings, getUserVerification, getRobloxGroupSettings } = require('../utils/database');
const { getUserGroupRank, isUserInGroup } = require('../utils/robloxApi');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            // Get guild settings
            const guildSettings = await getGuildSettings(member.guild.id);
            
            // Check if welcome channel is set
            if (guildSettings.welcomeChannel) {
                // Get welcome channel
                const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcomeChannel);
                
                if (welcomeChannel) {
                    // Create welcome embed
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('New Member!')
                        .setDescription(guildSettings.welcomeMessage || `Welcome to the Buckingham Palace Roblox server, ${member}! Please use the /verify command to link your Roblox account.`)
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'Buckingham Palace Roblox' });
                    
                    // Send welcome message
                    await welcomeChannel.send({
                        content: `Welcome, ${member}!`,
                        embeds: [welcomeEmbed]
                    });
                } else {
                    console.error(`Welcome channel not found for guild ${member.guild.id}`);
                }
            }
            
            // Check if the user is already verified
            const userData = await getUserVerification(member.user.id);
            
            if (userData && userData.verified && userData.robloxId) {
                // User is verified, assign appropriate roles
                console.log(`User ${member.user.tag} is already verified as Roblox ID: ${userData.robloxId}`);
                
                // Check for Roblox group role mappings
                const groupSettings = await getRobloxGroupSettings(member.guild.id);
                let groupRoleAssigned = false;
                
                if (groupSettings.enabled && groupSettings.groupId) {
                    // Check if user is in the configured Roblox group
                    const isInGroup = await isUserInGroup(userData.robloxId, groupSettings.groupId);
                    
                    if (isInGroup) {
                        // Get user's group rank
                        const rankInfo = await getUserGroupRank(userData.robloxId, groupSettings.groupId);
                        
                        if (rankInfo && rankInfo.rankId && groupSettings.roleMapping[rankInfo.rankId]) {
                            // Get the corresponding Discord role
                            const discordRoleId = groupSettings.roleMapping[rankInfo.rankId];
                            const discordRole = member.guild.roles.cache.get(discordRoleId);
                            
                            if (discordRole) {
                                // Assign the role
                                await member.roles.add(discordRole);
                                groupRoleAssigned = true;
                                console.log(`Assigned role ${discordRole.name} to rejoining verified member ${member.user.tag} based on Roblox rank: ${rankInfo.rankName}`);
                            }
                        }
                    }
                }
                
                // If no group role was assigned, assign the visitor role
                if (!groupRoleAssigned) {
                    const visitorRoleName = guildSettings.visitorRole || 'Visitor';
                    const visitorRole = member.guild.roles.cache.find(role => role.name === visitorRoleName);
                    
                    if (visitorRole) {
                        await member.roles.add(visitorRole);
                        console.log(`Assigned visitor role to rejoining verified member ${member.user.tag}`);
                    }
                }
            } else {
                // User is not verified, assign visitor role
                const visitorRoleName = guildSettings.visitorRole || 'Visitor';
                const visitorRole = member.guild.roles.cache.find(role => role.name === visitorRoleName);
                
                if (visitorRole) {
                    await member.roles.add(visitorRole);
                    console.log(`Assigned visitor role to new unverified member ${member.user.tag}`);
                }
            }
            
        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }
    },
};
