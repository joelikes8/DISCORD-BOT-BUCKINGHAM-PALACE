const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveGuildSettings, getGuildSettings } = require('../utils/database');
const { isModeratorOrAbove } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup bot features for your server')
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('Set up welcome messages')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel for welcome messages')
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
            const channel = interaction.options.getChannel('channel');
            
            // Make sure the channel is a text channel
            if (channel.type !== 0) {
                return interaction.reply({
                    content: 'Please select a text channel for welcome messages.',
                    ephemeral: true
                });
            }
            
            // Get current settings
            const guildSettings = await getGuildSettings(interaction.guildId);
            
            // Update settings
            guildSettings.welcomeChannel = channel.id;
            
            // Save settings
            await saveGuildSettings(interaction.guildId, guildSettings);
            
            return interaction.reply({
                content: `Welcome messages will now be sent to ${channel}!`,
                ephemeral: true
            });
        }
    },
};
