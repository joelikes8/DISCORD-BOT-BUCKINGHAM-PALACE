const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserVerification, saveGuildSettings } = require('../utils/database');
const { getRobloxUserInfo, getUserGroupRank, formatDisplayName } = require('../utils/robloxApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update your Discord name tag to match your current Roblox username and rank'),
    
    async execute(interaction) {
        // Check if the interaction has already been deferred by the event handler
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }
        
        // Check if the user is verified
        const userData = await getUserVerification(interaction.user.id);
        if (!userData || !userData.robloxId) {
            return interaction.editReply({ 
                content: 'You are not verified. Please use `/verify` first to link your Roblox account.', 
                ephemeral: true 
            });
        }
        
        // Get the user's Roblox information
        const robloxUserInfo = await getRobloxUserInfo(userData.robloxId);
        if (!robloxUserInfo) {
            return interaction.editReply({ 
                content: 'Failed to fetch your Roblox information. Please try again later.', 
                ephemeral: true 
            });
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(interaction.guild.id);
        if (!guildSettings || !guildSettings.robloxGroup || !guildSettings.robloxGroup.groupId || !guildSettings.robloxGroup.enabled) {
            // If no group settings, just update to Roblox username
            try {
                await interaction.member.setNickname(robloxUserInfo.username);
                
                const embed = new EmbedBuilder()
                    .setTitle('Name Updated')
                    .setDescription(`Your nickname has been updated to match your Roblox username.`)
                    .setColor('#00FF00')
                    .addFields(
                        { name: 'Roblox Username', value: robloxUserInfo.username, inline: true },
                        { name: 'New Nickname', value: robloxUserInfo.username, inline: true }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Error updating nickname:', error);
                return interaction.editReply({ 
                    content: 'Failed to update your nickname. This may be due to missing permissions.', 
                    ephemeral: true 
                });
            }
        }
        
        // If group settings are available, include rank information
        const groupId = guildSettings.robloxGroup.groupId;
        const rankInfo = await getUserGroupRank(userData.robloxId, groupId);
        
        let nickname = robloxUserInfo.username;
        if (rankInfo) {
            nickname = formatDisplayName(robloxUserInfo.username, rankInfo.rankName);
        }
        
        try {
            await interaction.member.setNickname(nickname);
            
            const embed = new EmbedBuilder()
                .setTitle('Name Updated')
                .setDescription(`Your nickname has been updated to match your Roblox username and rank.`)
                .setColor('#00FF00')
                .addFields(
                    { name: 'Roblox Username', value: robloxUserInfo.username, inline: true },
                    { name: 'Group Rank', value: rankInfo ? rankInfo.rankName : 'Not in group', inline: true },
                    { name: 'New Nickname', value: nickname, inline: true }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();
            
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error updating nickname:', error);
            return interaction.editReply({ 
                content: 'Failed to update your nickname. This may be due to missing permissions.', 
                ephemeral: true 
            });
        }
    },
};

// Add a helper function to get guild settings
async function getGuildSettings(guildId) {
    const { getGuildSettings } = require('../utils/database');
    return await getGuildSettings(guildId);
}