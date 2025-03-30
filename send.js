const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { saveGuildSettings, getGuildSettings } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send interactive messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ticket')
                .setDescription('Send a ticket message to a channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send the ticket message to')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'ticket') {
            const channel = interaction.options.getChannel('channel');
            
            // Make sure the channel is a text channel
            if (channel.type !== 0) {
                return interaction.reply({
                    content: 'Please select a text channel for the ticket message.',
                    ephemeral: true
                });
            }
            
            // Create ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Support Ticket')
                .setDescription('Click the button below to create a support ticket.')
                .setFooter({ text: 'Buckingham Palace Roblox Support' });
            
            // Create ticket button
            const ticketButton = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Success);
            
            const row = new ActionRowBuilder()
                .addComponents(ticketButton);
            
            // Send the message to the specified channel
            await channel.send({
                embeds: [ticketEmbed],
                components: [row]
            });
            
            // Update guild settings to store ticket channel
            const guildSettings = await getGuildSettings(interaction.guildId);
            guildSettings.ticketChannel = channel.id;
            await saveGuildSettings(interaction.guildId, guildSettings);
            
            return interaction.reply({
                content: `Ticket message has been sent to ${channel}!`,
                ephemeral: true
            });
        }
    },
};
