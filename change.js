const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveGuildSettings, getGuildSettings } = require('../utils/database');
const { isModeratorOrAbove } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('change')
        .setDescription('Change bot configurations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('Change welcome configuration')
                .addStringOption(option => 
                    option.setName('message')
                        .setDescription('The new welcome message')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        // Check if the user is a moderator or above
        if (!isModeratorOrAbove(interaction.member)) {
            return interaction.reply({
                content: 'You need to be a moderator or administrator to use this command.',
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'welcome') {
            const message = interaction.options.getString('message');
            
            // Get current settings
            const guildSettings = await getGuildSettings(interaction.guildId);
            
            // Update settings
            guildSettings.welcomeMessage = message;
            
            // Save settings
            await saveGuildSettings(interaction.guildId, guildSettings);
            
            return interaction.reply({
                content: `Welcome message updated to: "${message}"`,
                ephemeral: true
            });
        }
    },
};
