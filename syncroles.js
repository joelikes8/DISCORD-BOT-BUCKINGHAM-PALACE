const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getUserVerification, getRobloxGroupSettings, getGuildSettings } = require('../utils/database');
const { getUserGroupRank, isUserInGroup } = require('../utils/robloxApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncroles')
        .setDescription('Synchronize Roblox group roles for all verified members')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Get guild settings
            const guildId = interaction.guild.id;
            const groupSettings = await getRobloxGroupSettings(guildId);
            const guildSettings = await getGuildSettings(guildId);
            
            // Check if group integration is enabled and set up
            if (!groupSettings.enabled || !groupSettings.groupId) {
                return interaction.editReply(`Roblox group integration is not enabled. Please use \`/grouproles setup\` and \`/grouproles enable\` first.`);
            }
            
            // Check if there are any role mappings
            if (!groupSettings.roleMapping || Object.keys(groupSettings.roleMapping).length === 0) {
                return interaction.editReply(`No role mappings found. Please use \`/grouproles map\` to set up role mappings first.`);
            }
            
            // Get all members
            await interaction.guild.members.fetch();
            const members = interaction.guild.members.cache;
            
            // Track progress
            const stats = {
                total: members.size,
                verified: 0,
                rolesAssigned: 0,
                noMatch: 0,
                failed: 0
            };

            // Get visitor role
            const visitorRoleName = guildSettings.visitorRole || 'Visitor';
            const visitorRole = interaction.guild.roles.cache.find(role => role.name === visitorRoleName);
            
            // Start progress message
            await interaction.editReply(`Starting role synchronization for ${stats.total} members...`);
            
            // Process each member
            for (const [memberId, member] of members) {
                if (member.user.bot) continue; // Skip bots
                
                try {
                    // Check if member is verified
                    const userData = await getUserVerification(memberId);
                    
                    if (userData && userData.verified && userData.robloxId) {
                        stats.verified++;
                        let groupRoleAssigned = false;
                        
                        // Check if user is in group
                        const isInGroup = await isUserInGroup(userData.robloxId, groupSettings.groupId);
                        
                        if (isInGroup) {
                            // Get user's rank in group
                            const rankInfo = await getUserGroupRank(userData.robloxId, groupSettings.groupId);
                            
                            if (rankInfo && rankInfo.rankId && groupSettings.roleMapping[rankInfo.rankId]) {
                                // Get Discord role
                                const discordRoleId = groupSettings.roleMapping[rankInfo.rankId];
                                const discordRole = interaction.guild.roles.cache.get(discordRoleId);
                                
                                if (discordRole) {
                                    // Assign the role
                                    await member.roles.add(discordRole);
                                    
                                    // Remove visitor role if they got a group role
                                    if (visitorRole && member.roles.cache.has(visitorRole.id) && visitorRole.id !== discordRole.id) {
                                        await member.roles.remove(visitorRole);
                                    }
                                    
                                    groupRoleAssigned = true;
                                    stats.rolesAssigned++;
                                }
                            }
                        }
                        
                        // If no group role was assigned, make sure they have the visitor role
                        if (!groupRoleAssigned) {
                            stats.noMatch++;
                            
                            if (visitorRole && !member.roles.cache.has(visitorRole.id)) {
                                await member.roles.add(visitorRole);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error syncing roles for member ${member.user.tag}:`, error);
                    stats.failed++;
                }
                
                // Update progress message occasionally
                if ((stats.verified + stats.failed) % 10 === 0 || stats.verified + stats.failed === stats.total) {
                    await interaction.editReply(
                        `Synchronizing roles: ${stats.verified + stats.failed}/${stats.total} members processed.\n` +
                        `✅ ${stats.rolesAssigned} group roles assigned\n` +
                        `ℹ️ ${stats.noMatch} verified members with no matching group rank\n` +
                        `❌ ${stats.failed} errors encountered`
                    );
                }
            }
            
            // Final report
            await interaction.editReply(
                `Role synchronization complete!\n\n` +
                `Total members: ${stats.total}\n` +
                `Verified members: ${stats.verified}\n` +
                `Group roles assigned: ${stats.rolesAssigned}\n` +
                `No matching group rank: ${stats.noMatch}\n` +
                `Failed operations: ${stats.failed}`
            );
            
        } catch (error) {
            console.error('Error in syncroles command:', error);
            await interaction.editReply('An error occurred while synchronizing roles. Please check the server logs for details.');
        }
    }
};