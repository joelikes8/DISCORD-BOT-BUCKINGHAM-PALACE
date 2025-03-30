const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRobloxUserByUsername, setUserRank, formatDisplayName, isRobloxAuthenticated, getGroupRanks } = require('../utils/robloxApi');
const { isModeratorOrAbove } = require('../utils/permissions');
const { getGuildSettings, saveGuildSettings } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote a user in the Roblox group and update their Discord name')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The Roblox username of the user to promote')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('rank')
                .setDescription('The rank ID to set for the user')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        // Check if the interaction has already been deferred by the event handler
        // If not, defer it
        if (!interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }
        
        // Check if user has permission
        if (!isModeratorOrAbove(interaction.member)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        
        // Check if the Roblox client is authenticated
        if (!isRobloxAuthenticated()) {
            return interaction.editReply({ 
                content: 'The bot is not authenticated with Roblox. Please ensure the ROBLOX_COOKIE environment variable is set.', 
                ephemeral: true 
            });
        }
        
        // Get guild settings
        const guildSettings = await getGuildSettings(interaction.guild.id);
        if (!guildSettings || !guildSettings.robloxGroup || !guildSettings.robloxGroup.groupId) {
            return interaction.editReply({ 
                content: 'The Roblox group ID has not been set up. Please use `/grouproles setup` first.', 
                ephemeral: true 
            });
        }
        
        if (!guildSettings.robloxGroup.enabled) {
            return interaction.editReply({ 
                content: 'Roblox group integration is disabled. Please use `/grouproles enable` first.', 
                ephemeral: true 
            });
        }
        
        const groupId = guildSettings.robloxGroup.groupId;
        const robloxUsername = interaction.options.getString('username');
        const rankId = interaction.options.getInteger('rank');
        
        // Fetch available ranks to validate the provided rank ID
        const availableRanks = await getGroupRanks(groupId);
        if (!availableRanks) {
            return interaction.editReply({ 
                content: 'Failed to fetch group ranks. Please try again later.', 
                ephemeral: true 
            });
        }
        
        // Validate the rank ID
        const rankExists = availableRanks.some(rank => rank.id === rankId);
        if (!rankExists) {
            const validRanks = availableRanks.map(rank => `${rank.id}: ${rank.name}`).join('\n');
            return interaction.editReply({ 
                content: `Invalid rank ID. Please choose from one of the following:\n\n${validRanks}`, 
                ephemeral: true 
            });
        }
        
        // Find the Roblox user
        const robloxUser = await getRobloxUserByUsername(robloxUsername);
        if (!robloxUser) {
            return interaction.editReply({ content: `Could not find a Roblox user with the username "${robloxUsername}".`, ephemeral: true });
        }
        
        // Set the user's rank in the Roblox group
        const promotionResult = await setUserRank(robloxUser.id, groupId, rankId);
        
        if (!promotionResult || !promotionResult.success) {
            return interaction.editReply({ 
                content: `Failed to set user's rank: ${promotionResult?.error || 'Unknown error'}`, 
                ephemeral: true 
            });
        }
        
        // Get Discord member with the same Roblox username
        let targetMember = null;
        try {
            const guildMembers = await interaction.guild.members.fetch();
            targetMember = guildMembers.find(member => {
                // Check if nickname contains the Roblox username (disregard rank part)
                const nickname = member.displayName;
                return nickname && nickname.toLowerCase().includes(robloxUsername.toLowerCase());
            });
        } catch (error) {
            console.error('Error fetching guild members:', error);
        }
        
        // Update the user's Discord nickname with their new rank
        let nicknameUpdated = false;
        if (targetMember) {
            try {
                const newNickname = formatDisplayName(robloxUser.username, promotionResult.newRank.rankName);
                await targetMember.setNickname(newNickname);
                nicknameUpdated = true;
            } catch (error) {
                console.error('Error updating nickname:', error);
            }
        }
        
        // Find the rank name for display
        const rankName = availableRanks.find(rank => rank.id === rankId)?.name || 'Unknown Rank';
        
        // Create a success embed
        const embed = new EmbedBuilder()
            .setTitle('User Rank Updated')
            .setDescription(`Successfully set ${robloxUser.username}'s rank in the Roblox group.`)
            .setColor('#00FF00')
            .addFields(
                { name: 'Username', value: robloxUser.username, inline: true },
                { name: 'Roblox ID', value: robloxUser.id.toString(), inline: true },
                { name: 'Previous Rank', value: promotionResult.oldRank?.rankName || 'N/A', inline: true },
                { name: 'New Rank', value: rankName, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        // Add information about Discord nickname update
        if (targetMember) {
            embed.addFields(
                { name: 'Discord User', value: targetMember.toString(), inline: true },
                { name: 'Nickname Updated', value: nicknameUpdated ? '✅ Yes' : '❌ No', inline: true }
            );
        } else {
            embed.addFields(
                { name: 'Discord User', value: 'Not found in server', inline: true }
            );
        }
        
        return interaction.editReply({ embeds: [embed], ephemeral: true });
    },
};