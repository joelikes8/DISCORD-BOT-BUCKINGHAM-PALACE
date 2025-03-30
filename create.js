const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveApplication, getGuildSettings, saveGuildSettings } = require('../utils/database');
const { isModeratorOrAbove } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create server configurations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('application')
                .setDescription('Create a new application form')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the application')
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
        
        if (subcommand === 'application') {
            const applicationName = interaction.options.getString('name');
            
            await interaction.reply({
                content: `Creating a new application form: "${applicationName}". Please enter your first question (or type "done" to finish):`,
                ephemeral: true
            });
            
            // Set up a collector for message input
            const filter = m => m.author.id === interaction.user.id;
            const messageCollector = interaction.channel.createMessageCollector({ 
                filter, 
                time: 300000 // 5 minutes timeout
            });
            
            const questions = [];
            let messagePrompt = 'Please enter your next question (or type "done" to finish):';
            
            messageCollector.on('collect', async (message) => {
                const content = message.content.trim();
                
                // Delete the message to keep things clean
                try {
                    await message.delete();
                } catch (error) {
                    console.error('Failed to delete message:', error);
                }
                
                if (content.toLowerCase() === 'done') {
                    if (questions.length === 0) {
                        await interaction.followUp({
                            content: 'You need at least one question for the application.',
                            ephemeral: true
                        });
                        return;
                    }
                    
                    messageCollector.stop('completed');
                    return;
                }
                
                questions.push(content);
                
                await interaction.followUp({
                    content: messagePrompt,
                    ephemeral: true
                });
            });
            
            messageCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await interaction.followUp({
                        content: 'Application creation timed out. Please try again.',
                        ephemeral: true
                    });
                    return;
                }
                
                if (reason === 'completed') {
                    // Save the application to the database
                    await saveApplication(interaction.guildId, applicationName, questions);
                    
                    // Update guild settings to include the new application
                    const guildSettings = await getGuildSettings(interaction.guildId);
                    if (!guildSettings.applications) {
                        guildSettings.applications = {};
                    }
                    guildSettings.applications[applicationName] = true;
                    await saveGuildSettings(interaction.guildId, guildSettings);
                    
                    await interaction.followUp({
                        content: `Application "${applicationName}" has been created with ${questions.length} question(s).`,
                        ephemeral: true
                    });
                }
            });
        }
    },
};
