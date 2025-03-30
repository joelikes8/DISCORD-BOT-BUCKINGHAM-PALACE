const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getApplication } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apply')
        .setDescription('Apply for a position in the Buckingham Palace Roblox server')
        .addStringOption(option =>
            option.setName('application')
                .setDescription('The application type')
                .setRequired(true)),
    
    async execute(interaction) {
        const applicationType = interaction.options.getString('application');
        
        // Check if the application exists
        const application = await getApplication(interaction.guildId, applicationType);
        
        if (!application) {
            return interaction.reply({
                content: `Application type "${applicationType}" does not exist. Available applications: ${await getAvailableApplications(interaction.guildId)}`,
                ephemeral: true
            });
        }
        
        try {
            // Create application embed
            const applicationEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`${applicationType} Application`)
                .setDescription(`You have requested to apply for ${applicationType}. Click the button below to begin the application process.`)
                .setFooter({ text: 'Buckingham Palace Roblox Applications' });
            
            // Create application button with encoded guild ID
            const applyButton = new ButtonBuilder()
                .setCustomId(`start_application_${interaction.guildId}_${applicationType}`)
                .setLabel('Start Application')
                .setStyle(ButtonStyle.Success);
            
            const row = new ActionRowBuilder()
                .addComponents(applyButton);
            
            // Send the DM to the user
            await interaction.user.send({
                embeds: [applicationEmbed],
                components: [row]
            });
            
            return interaction.reply({
                content: 'I\'ve sent you a DM with the application details!',
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'I couldn\'t send you a DM. Please make sure you have DMs enabled for this server.',
                ephemeral: true
            });
        }
    },
};

// Helper function to get available applications
async function getAvailableApplications(guildId) {
    const applications = await getApplicationList(guildId);
    if (applications.length === 0) {
        return "No applications available. Ask a moderator to create applications using /create application";
    }
    return applications.join(', ');
}

// This function would be implemented in database.js
async function getApplicationList(guildId) {
    const { getGuildSettings } = require('../utils/database');
    const settings = await getGuildSettings(guildId);
    return settings.applications ? Object.keys(settings.applications) : [];
}
