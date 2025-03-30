const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRobloxGroupSettings, setRobloxGroupId, toggleRobloxGroupIntegration, mapRobloxRankToDiscordRole, removeRobloxRankMapping } = require('../utils/database');
const { getGroupRanks } = require('../utils/robloxApi');
const { isModeratorOrAbove } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grouproles')
        .setDescription('Configure Roblox group role integration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the Roblox group integration')
                .addIntegerOption(option =>
                    option.setName('group_id')
                        .setDescription('The Roblox group ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable or disable Roblox group integration')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Whether to enable or disable Roblox group integration')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('map')
                .setDescription('Map a Roblox group rank to a Discord role')
                .addIntegerOption(option =>
                    option.setName('rank_id')
                        .setDescription('The Roblox group rank ID')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The Discord role to map to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unmap')
                .setDescription('Remove a mapping for a Roblox group rank')
                .addIntegerOption(option =>
                    option.setName('rank_id')
                        .setDescription('The Roblox group rank ID to unmap')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current Roblox group role mappings')),
    async execute(interaction) {
        // Double-check if the user is a moderator or administrator
        if (!isModeratorOrAbove(interaction.member)) {
            return interaction.reply({
                content: 'You need to be a moderator or administrator to use this command.',
                ephemeral: true
            });
        }
        
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'setup':
                    await handleSetup(interaction, guildId);
                    break;
                case 'enable':
                    await handleEnable(interaction, guildId);
                    break;
                case 'map':
                    await handleMap(interaction, guildId);
                    break;
                case 'unmap':
                    await handleUnmap(interaction, guildId);
                    break;
                case 'view':
                    await handleView(interaction, guildId);
                    break;
            }
        } catch (error) {
            console.error(`Error in grouproles command:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: 'There was an error executing this command.' });
            }
        }
    }
};

async function handleSetup(interaction, guildId) {
    const groupId = interaction.options.getInteger('group_id');
    
    // Check if the interaction has already been deferred by the event handler
    if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    // Validate the group ID by trying to fetch roles
    const groupRanks = await getGroupRanks(groupId);
    
    if (!groupRanks) {
        return await interaction.editReply(`Could not find a Roblox group with ID ${groupId}. Please check the ID and try again.`);
    }
    
    // Save the group ID
    await setRobloxGroupId(guildId, groupId);
    
    // Format a nice response with the available ranks
    const embed = new EmbedBuilder()
        .setTitle(`Roblox Group Roles`)
        .setDescription(`Group ID: ${groupId} has been set up successfully.\n\nUse \`/grouproles map\` to map Roblox ranks to Discord roles.`)
        .setColor(0x0099FF)
        .addFields(
            { name: 'Available Ranks', value: formatRanksList(groupRanks) }
        )
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleEnable(interaction, guildId) {
    const enabled = interaction.options.getBoolean('enabled');
    
    // Check if the interaction has already been deferred by the event handler
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    // Get current settings
    const groupSettings = await getRobloxGroupSettings(guildId);
    
    if (!groupSettings.groupId) {
        return await interaction.editReply(`You need to set up a Roblox group first with \`/grouproles setup\``);
    }
    
    // Toggle the integration
    await toggleRobloxGroupIntegration(guildId, enabled);
    
    await interaction.editReply(`Roblox group integration has been ${enabled ? 'enabled' : 'disabled'}.`);
}

async function handleMap(interaction, guildId) {
    const rankId = interaction.options.getInteger('rank_id');
    const role = interaction.options.getRole('role');
    
    // Check if the interaction has already been deferred by the event handler
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    // Get current settings
    const groupSettings = await getRobloxGroupSettings(guildId);
    
    if (!groupSettings.groupId) {
        return await interaction.editReply(`You need to set up a Roblox group first with \`/grouproles setup\``);
    }
    
    // Get group roles to validate the rank ID
    const groupRanks = await getGroupRanks(groupSettings.groupId);
    
    if (!groupRanks) {
        return await interaction.editReply(`Could not fetch ranks for the configured Roblox group. Please check the group ID.`);
    }
    
    // Validate that the rank exists
    const rankExists = groupRanks.some(rank => rank.id === rankId);
    
    if (!rankExists) {
        return await interaction.editReply(`Rank ID ${rankId} does not exist in the configured Roblox group.`);
    }
    
    // Save the mapping
    await mapRobloxRankToDiscordRole(guildId, rankId, role.id);
    
    const rankName = groupRanks.find(rank => rank.id === rankId)?.name || `Rank ${rankId}`;
    
    await interaction.editReply(`Successfully mapped Roblox rank "${rankName}" to Discord role "${role.name}".`);
}

async function handleUnmap(interaction, guildId) {
    const rankId = interaction.options.getInteger('rank_id');
    
    // Check if the interaction has already been deferred by the event handler
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    // Get current settings
    const groupSettings = await getRobloxGroupSettings(guildId);
    
    if (!groupSettings.groupId) {
        return await interaction.editReply(`You need to set up a Roblox group first with \`/grouproles setup\``);
    }
    
    // Check if the mapping exists
    if (!groupSettings.roleMapping || !groupSettings.roleMapping[rankId]) {
        return await interaction.editReply(`No mapping exists for Roblox rank ID ${rankId}.`);
    }
    
    // Remove the mapping
    await removeRobloxRankMapping(guildId, rankId);
    
    await interaction.editReply(`Successfully removed mapping for Roblox rank ID ${rankId}.`);
}

async function handleView(interaction, guildId) {
    // Check if the interaction has already been deferred by the event handler
    if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    // Get current settings
    const groupSettings = await getRobloxGroupSettings(guildId);
    
    if (!groupSettings.groupId) {
        return await interaction.editReply(`No Roblox group has been set up yet. Use \`/grouproles setup\` to set one up.`);
    }
    
    // Get group roles for display
    const groupRanks = await getGroupRanks(groupSettings.groupId);
    
    if (!groupRanks) {
        return await interaction.editReply(`Could not fetch ranks for the configured Roblox group (ID: ${groupSettings.groupId}).`);
    }
    
    // Create an embed with the current mappings
    const embed = new EmbedBuilder()
        .setTitle(`Roblox Group Role Mappings`)
        .setDescription(`Status: ${groupSettings.enabled ? '✅ Enabled' : '❌ Disabled'}\nGroup ID: ${groupSettings.groupId}`)
        .setColor(0x0099FF)
        .setTimestamp();
    
    // Add fields for mappings
    if (!groupSettings.roleMapping || Object.keys(groupSettings.roleMapping).length === 0) {
        embed.addFields({ name: 'Mappings', value: 'No role mappings have been configured yet.' });
    } else {
        let mappingsText = '';
        
        for (const [rankId, roleId] of Object.entries(groupSettings.roleMapping)) {
            const rank = groupRanks.find(r => r.id === parseInt(rankId));
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (rank && role) {
                mappingsText += `• Roblox Rank: **${rank.name}** (ID: ${rankId}) → Discord Role: **${role.name}**\n`;
            } else {
                mappingsText += `• Roblox Rank ID: ${rankId} → Discord Role ID: ${roleId} (not found)\n`;
            }
        }
        
        embed.addFields({ name: 'Current Mappings', value: mappingsText || 'No valid mappings found.' });
    }
    
    // Add available ranks field
    embed.addFields({ name: 'Available Ranks', value: formatRanksList(groupRanks) });
    
    await interaction.editReply({ embeds: [embed] });
}

function formatRanksList(ranks) {
    if (!ranks || ranks.length === 0) {
        return 'No ranks found.';
    }
    
    return ranks.map(rank => `• ${rank.name} (ID: ${rank.id})`).join('\n');
}