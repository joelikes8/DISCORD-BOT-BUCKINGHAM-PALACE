const { Events } = require('discord.js');
const { 
    getUserVerification, 
    saveUserVerification, 
    getGuildSettings, 
    getApplication,
    getTempApplicationData,
    saveTempApplicationData,
    clearTempApplicationData,
    getRobloxGroupSettings
} = require('../utils/database');
const { verifyRobloxUser, getUserGroupRank, isUserInGroup } = require('../utils/robloxApi');
const { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Defer reply to prevent timeout for long-running commands
                // Don't defer on simple commands that need immediate response
                const fastCommands = ['help', 'ping']; // Add any commands that should respond immediately
                
                if (!fastCommands.includes(interaction.commandName)) {
                    // Defer the reply with ephemeral state matching the command's typical usage
                    await interaction.deferReply({ 
                        ephemeral: ['verify', 'setup', 'apply', 'create', 'promote', 'update', 'grouproles'].includes(interaction.commandName)
                    });
                }
                
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
            return;
        }
        
        // Handle buttons
        if (interaction.isButton()) {
            // Handle ticket creation
            if (interaction.customId === 'create_ticket') {
                // Defer reply as ticket creation involves channel creation
                await interaction.deferReply({ ephemeral: true });
                await handleTicketCreation(interaction);
                return;
            }
            
            // Handle Roblox verification button
            if (interaction.customId.startsWith('verify_roblox_')) {
                // Defer reply as verification can take time
                await interaction.deferReply({ ephemeral: true });
                await handleRobloxVerification(interaction);
                return;
            }
            
            // Handle application start button
            if (interaction.customId.startsWith('start_application_')) {
                const parts = interaction.customId.replace('start_application_', '').split('_');
                const guildId = parts[0];
                const applicationType = parts.slice(1).join('_'); // Join the rest in case application type has underscores
                
                // Add the guildId to the interaction for DM context
                interaction.guildId = guildId;
                
                // Defer reply as application setup involves database operations
                await interaction.deferReply({ ephemeral: true });
                await handleApplicationStart(interaction, applicationType);
                return;
            }
            
            // Handle application navigation buttons
            if (interaction.customId === 'application_next') {
                // Defer reply as navigation involves database operations
                await interaction.deferReply({ ephemeral: true });
                await handleApplicationNext(interaction);
                return;
            }
            
            if (interaction.customId === 'application_previous') {
                // Defer reply as navigation involves database operations
                await interaction.deferReply({ ephemeral: true });
                await handleApplicationPrevious(interaction);
                return;
            }
            
            if (interaction.customId === 'application_submit') {
                // Defer reply as application submission involves database operations
                await interaction.deferReply({ ephemeral: true });
                await handleApplicationSubmit(interaction);
                return;
            }
            
            // Handle answer button for subsequent questions
            if (interaction.customId.startsWith('answer_next_')) {
                const questionIndex = parseInt(interaction.customId.replace('answer_next_', ''));
                // Defer reply as we'll be showing a modal which may take time to create
                await interaction.deferReply({ ephemeral: true });
                await handleNextQuestionAnswer(interaction, questionIndex);
                return;
            }
        }
        
        // Handle modals (for application answers)
        if (interaction.isModalSubmit() && interaction.customId.startsWith('application_question_')) {
            // Defer reply as processing application questions requires database operations
            await interaction.deferReply({ ephemeral: true });
            await handleApplicationQuestionSubmit(interaction);
            return;
        }
    },
};

// Handle ticket creation
async function handleTicketCreation(interaction) {
    try {
        const guildSettings = await getGuildSettings(interaction.guildId);
        
        // Create a new ticket channel
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.id, // @everyone role
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id, // Ticket creator
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    id: interaction.client.user.id, // Bot
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });
        
        // Add moderator role permissions if it exists
        const moderatorRole = interaction.guild.roles.cache.find(role => 
            role.permissions.has(PermissionFlagsBits.ModerateMembers));
        
        if (moderatorRole) {
            await ticketChannel.permissionOverwrites.create(moderatorRole, {
                ViewChannel: true,
                SendMessages: true,
            });
        }
        
        // Create close ticket button
        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder()
            .addComponents(closeButton);
        
        // Send initial message in the ticket channel
        await ticketChannel.send({
            content: `<@${interaction.user.id}> has created a ticket.`,
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Support Ticket')
                    .setDescription('Please describe your issue, and a staff member will assist you shortly.')
                    .setFooter({ text: 'Buckingham Palace Roblox Support' })
            ],
            components: [row]
        });
        
        // Acknowledge the ticket creation (use editReply since we deferred)
        await interaction.editReply({
            content: `Ticket created: ${ticketChannel}`,
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error creating ticket:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'There was an error creating your ticket. Please try again later.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'There was an error creating your ticket. Please try again later.',
                ephemeral: true
            });
        }
    }
}

// Handle Roblox verification
async function handleRobloxVerification(interaction) {
    try {
        const robloxId = interaction.customId.replace('verify_roblox_', '');
        const userData = await getUserVerification(interaction.user.id);
        
        if (!userData || userData.robloxId !== parseInt(robloxId)) {
            return interaction.reply({
                content: 'Verification data not found or mismatch. Please try the verification process again.',
                ephemeral: true
            });
        }
        
        // Verify if the code is in the Roblox profile
        const isVerified = await verifyRobloxUser(robloxId, userData.code);
        
        if (!isVerified) {
            return interaction.reply({
                content: 'Verification failed. Please make sure you added the verification code to your Roblox profile\'s About section and try again.',
                ephemeral: true
            });
        }
        
        // Update verification status
        userData.verified = true;
        await saveUserVerification(interaction.user.id, userData);
        
        // Save verification to the database
        await saveVerifiedUser(interaction.user.id, userData.robloxId, userData.robloxUsername);
        
        // Get guild settings for role assignment
        const guildSettings = await getGuildSettings(interaction.guildId);
        const visitorRoleName = guildSettings.visitorRole || 'Visitor';
        
        // Begin with role management - first assign visitor role
        let assignedGroupRole = false;
        let roleAssignmentMessage = '';
        
        const visitorRole = interaction.guild.roles.cache.find(role => role.name === visitorRoleName);
        if (visitorRole) {
            await interaction.member.roles.add(visitorRole);
            roleAssignmentMessage = `You've been assigned the ${visitorRoleName} role.`;
        }
        
        // Check for Roblox group role mappings
        const groupSettings = await getRobloxGroupSettings(interaction.guildId);
        
        if (groupSettings.enabled && groupSettings.groupId) {
            // Check if user is in the configured Roblox group
            const isInGroup = await isUserInGroup(robloxId, groupSettings.groupId);
            
            if (isInGroup) {
                // Get user's group rank
                const rankInfo = await getUserGroupRank(robloxId, groupSettings.groupId);
                
                if (rankInfo && rankInfo.rankId && groupSettings.roleMapping[rankInfo.rankId]) {
                    // Get the corresponding Discord role
                    const discordRoleId = groupSettings.roleMapping[rankInfo.rankId];
                    const discordRole = interaction.guild.roles.cache.get(discordRoleId);
                    
                    if (discordRole) {
                        // Assign the role
                        await interaction.member.roles.add(discordRole);
                        assignedGroupRole = true;
                        
                        // Update the message
                        roleAssignmentMessage = `You've been assigned the ${discordRole.name} role based on your Roblox group rank: ${rankInfo.rankName}.`;
                        
                        // Remove visitor role if they got a group role
                        if (visitorRole && visitorRole.id !== discordRole.id) {
                            await interaction.member.roles.remove(visitorRole);
                        }
                    }
                }
            }
        }
        
        // Change the user's nickname to their Roblox username
        try {
            await interaction.member.setNickname(userData.robloxUsername);
            await updateGuildUserNickname(interaction.guildId, interaction.user.id, true);
        } catch (nicknameError) {
            console.warn(`Could not change nickname for user ${interaction.user.id}:`, nicknameError);
            // Continue verification process even if nickname change fails
        }
        
        // Update roles sync status
        await updateGuildUserRoleSync(interaction.guildId, interaction.user.id, true);
        
        // Prepare verification success message
        let successMessage = `Successfully verified as Roblox user: ${userData.robloxUsername}!`;
        if (roleAssignmentMessage) {
            successMessage += `\n${roleAssignmentMessage}`;
        }
        
        // Add information about group roles if not assigned
        if (groupSettings.enabled && groupSettings.groupId && !assignedGroupRole) {
            successMessage += `\nNote: You were not assigned any group-specific roles. To get a role based on your group rank, join the Roblox group with ID: ${groupSettings.groupId}.`;
        }
        
        // Add information about nickname change
        successMessage += `\nYour nickname has been changed to match your Roblox username: ${userData.robloxUsername}`;
        
        // Acknowledge verification (use editReply since we deferred)
        await interaction.editReply({
            content: successMessage,
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred during verification. Please try again later.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'An error occurred during verification. Please try again later.',
                ephemeral: true
            });
        }
    }
}

// Handle application start
async function handleApplicationStart(interaction, applicationType) {
    try {
        // Check if we're in DMs and retrieve the stored guildId
        const guildId = interaction.guild ? interaction.guild.id : interaction.guildId;
        
        if (!guildId) {
            return interaction.reply({
                content: "Unable to determine which server this application is for. Please start the application from a server using the /apply command.",
                ephemeral: true
            });
        }
        
        // Get application questions
        const application = await getApplication(guildId, applicationType);
        
        if (!application) {
            return interaction.reply({
                content: `Application "${applicationType}" not found.`,
                ephemeral: true
            });
        }
        
        // Initialize application data
        const applicationData = {
            userId: interaction.user.id,
            guildId: guildId,
            type: applicationType,
            currentQuestion: 0,
            answers: [],
            startTime: Date.now()
        };
        
        await saveTempApplicationData(interaction.user.id, applicationData);
        
        // Send first question
        await sendApplicationQuestion(interaction, application.questions, 0);
        
    } catch (error) {
        console.error('Application error:', error);
        await interaction.reply({
            content: 'An error occurred while starting the application. Please try again later.',
            ephemeral: true
        });
    }
}

// Send an application question
async function sendApplicationQuestion(interaction, questions, index) {
    try {
        // For the first question or when starting the application, we can use a modal
        if (index === 0 && interaction.customId && interaction.customId.startsWith('start_application_')) {
            // Create question modal for the first question
            const modal = new ModalBuilder()
                .setCustomId(`application_question_${index}`)
                .setTitle(`Question ${index + 1}/${questions.length}`);
            
            // Add text input for the answer
            const answerInput = new TextInputBuilder()
                .setCustomId('answer')
                .setLabel(questions[index])
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            
            const firstActionRow = new ActionRowBuilder().addComponents(answerInput);
            modal.addComponents(firstActionRow);
            
            // Show the modal
            await interaction.showModal(modal);
        } 
        // For subsequent questions, we'll use a message with a text input button
        else {
            // Create a message with the question
            const questionEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Question ${index + 1}/${questions.length}`)
                .setDescription(questions[index])
                .setFooter({ text: 'Click the button below to answer this question' });
            
            // Create collector button
            const answerButton = new ButtonBuilder()
                .setCustomId(`answer_next_${index}`)
                .setLabel('Answer this question')
                .setStyle(ButtonStyle.Primary);
            
            const row = new ActionRowBuilder()
                .addComponents(answerButton);
            
            // If this is a follow-up question (not the first one)
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    embeds: [questionEmbed],
                    components: [row],
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    embeds: [questionEmbed],
                    components: [row],
                    ephemeral: true
                });
            }
        }
    } catch (error) {
        console.error('Error sending application question:', error);
        // Send error message only if we haven't replied yet
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing your application. Please try again later.',
                ephemeral: true
            });
        } else {
            await interaction.followUp({
                content: 'An error occurred while processing your application. Please try again later.',
                ephemeral: true
            });
        }
    }
}

// Handle application question submission
async function handleApplicationQuestionSubmit(interaction) {
    try {
        const questionIndex = parseInt(interaction.customId.replace('application_question_', ''));
        const answer = interaction.fields.getTextInputValue('answer');
        
        // Get application data
        const applicationData = await getTempApplicationData(interaction.user.id);
        
        if (!applicationData) {
            return interaction.editReply({
                content: 'Application session expired. Please start over.',
                ephemeral: true
            });
        }
        
        // Get application questions
        const application = await getApplication(applicationData.guildId, applicationData.type);
        
        if (!application) {
            return interaction.editReply({
                content: 'Application not found. Please start over.',
                ephemeral: true
            });
        }
        
        // Save answer
        applicationData.answers[questionIndex] = answer;
        applicationData.currentQuestion = questionIndex + 1;
        await saveTempApplicationData(interaction.user.id, applicationData);
        
        // Check if this was the last question
        if (questionIndex >= application.questions.length - 1) {
            // Show review and submit options
            const reviewEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Application Review: ${applicationData.type}`)
                .setDescription('Please review your answers before submitting:')
                .addFields(
                    application.questions.map((question, index) => ({
                        name: `Question ${index + 1}`,
                        value: `**${question}**\n${applicationData.answers[index] || 'Not answered'}`
                    }))
                )
                .setFooter({ text: 'Buckingham Palace Roblox Applications' });
            
            // Create submit and edit buttons
            const submitButton = new ButtonBuilder()
                .setCustomId('application_submit')
                .setLabel('Submit Application')
                .setStyle(ButtonStyle.Success);
            
            const previousButton = new ButtonBuilder()
                .setCustomId('application_previous')
                .setLabel('Edit Previous Answers')
                .setStyle(ButtonStyle.Secondary);
            
            const row = new ActionRowBuilder()
                .addComponents(previousButton, submitButton);
            
            await interaction.reply({
                embeds: [reviewEmbed],
                components: [row],
                ephemeral: true
            });
            
        } else {
            // Show next question
            await interaction.editReply({
                content: `Answer received! Moving to question ${questionIndex + 2}/${application.questions.length}`,
                ephemeral: true
            });
            
            // Send next question
            await sendApplicationQuestion(interaction, application.questions, questionIndex + 1);
        }
        
    } catch (error) {
        console.error('Error handling application answer:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while processing your application. Please try again later.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'An error occurred while processing your application. Please try again later.',
                ephemeral: true
            });
        }
    }
}

// Handle application next button
async function handleApplicationNext(interaction) {
    try {
        const applicationData = await getTempApplicationData(interaction.user.id);
        
        if (!applicationData) {
            return interaction.editReply({
                content: 'Application session expired. Please start over.',
                ephemeral: true
            });
        }
        
        const application = await getApplication(applicationData.guildId, applicationData.type);
        
        if (!application) {
            return interaction.reply({
                content: 'Application not found. Please start over.',
                ephemeral: true
            });
        }
        
        // Ensure we don't go out of bounds
        if (applicationData.currentQuestion >= application.questions.length) {
            applicationData.currentQuestion = application.questions.length - 1;
        }
        
        await saveTempApplicationData(interaction.user.id, applicationData);
        
        // Send the current question
        await sendApplicationQuestion(interaction, application.questions, applicationData.currentQuestion);
        
        // Update the original message
        await interaction.update({
            content: `Moving to question ${applicationData.currentQuestion + 1}/${application.questions.length}`,
            embeds: [],
            components: []
        });
        
    } catch (error) {
        console.error('Error navigating application:', error);
        await interaction.reply({
            content: 'An error occurred while processing your application. Please try again later.',
            ephemeral: true
        });
    }
}

// Handle application previous button
async function handleApplicationPrevious(interaction) {
    try {
        const applicationData = await getTempApplicationData(interaction.user.id);
        
        if (!applicationData) {
            return interaction.reply({
                content: 'Application session expired. Please start over.',
                ephemeral: true
            });
        }
        
        const application = await getApplication(applicationData.guildId, applicationData.type);
        
        if (!application) {
            return interaction.reply({
                content: 'Application not found. Please start over.',
                ephemeral: true
            });
        }
        
        // Go back to the first question
        applicationData.currentQuestion = 0;
        await saveTempApplicationData(interaction.user.id, applicationData);
        
        // Send the first question
        await sendApplicationQuestion(interaction, application.questions, 0);
        
        // Update the original message
        await interaction.update({
            content: `Going back to question 1/${application.questions.length}`,
            embeds: [],
            components: []
        });
        
    } catch (error) {
        console.error('Error navigating application:', error);
        await interaction.reply({
            content: 'An error occurred while processing your application. Please try again later.',
            ephemeral: true
        });
    }
}

// Handle next question answer with button
async function handleNextQuestionAnswer(interaction, questionIndex) {
    try {
        // Create question modal for text input
        const modal = new ModalBuilder()
            .setCustomId(`application_question_${questionIndex}`)
            .setTitle(`Question ${questionIndex + 1}`);
        
        // Get application data to get the question text
        const applicationData = await getTempApplicationData(interaction.user.id);
        
        if (!applicationData) {
            return interaction.reply({
                content: 'Application session expired. Please start over.',
                ephemeral: true
            });
        }
        
        // Get application questions
        const application = await getApplication(applicationData.guildId, applicationData.type);
        
        if (!application) {
            return interaction.reply({
                content: 'Application not found. Please start over.',
                ephemeral: true
            });
        }
        
        // Add text input for the answer
        const answerInput = new TextInputBuilder()
            .setCustomId('answer')
            .setLabel(application.questions[questionIndex])
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
        
        const firstActionRow = new ActionRowBuilder().addComponents(answerInput);
        modal.addComponents(firstActionRow);
        
        // Show the modal
        await interaction.showModal(modal);
        
    } catch (error) {
        console.error('Error handling next question:', error);
        await interaction.reply({
            content: 'An error occurred while processing your application. Please try again later.',
            ephemeral: true
        });
    }
}

// Handle application submit button
async function handleApplicationSubmit(interaction) {
    try {
        const applicationData = await getTempApplicationData(interaction.user.id);
        
        if (!applicationData) {
            return interaction.reply({
                content: 'Application session expired. Please start over.',
                ephemeral: true
            });
        }
        
        const application = await getApplication(applicationData.guildId, applicationData.type);
        
        if (!application) {
            return interaction.reply({
                content: 'Application not found. Please start over.',
                ephemeral: true
            });
        }
        
        // Check if all questions are answered
        if (applicationData.answers.length < application.questions.length || 
            applicationData.answers.some(answer => !answer)) {
            return interaction.reply({
                content: 'Please answer all questions before submitting.',
                ephemeral: true
            });
        }
        
        // Find a moderator or admin to send the application to
        const guild = interaction.client.guilds.cache.get(applicationData.guildId);
        const moderatorRole = guild.roles.cache.find(role => 
            role.permissions.has(PermissionFlagsBits.ModerateMembers));
        
        let moderators = [];
        if (moderatorRole) {
            moderators = moderatorRole.members.map(member => member.user);
        }
        
        // Create application submission embed
        const submissionEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Application Submission: ${applicationData.type}`)
            .setDescription(`Submitted by: ${interaction.user.tag} (${interaction.user.id})`)
            .addFields(
                application.questions.map((question, index) => ({
                    name: `Question ${index + 1}`,
                    value: `**${question}**\n${applicationData.answers[index] || 'Not answered'}`
                }))
            )
            .setTimestamp()
            .setFooter({ text: 'Buckingham Palace Roblox Applications' });
        
        // Try to find or create an applications channel
        let applicationsChannel = guild.channels.cache.find(channel => 
            channel.name.toLowerCase().includes('application') && channel.type === ChannelType.GuildText);
        
        if (!applicationsChannel && moderatorRole) {
            // Create applications channel if it doesn't exist
            applicationsChannel = await guild.channels.create({
                name: 'applications',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone role
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: moderatorRole.id, // Moderator role
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: interaction.client.user.id, // Bot
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });
        }
        
        // Send to applications channel if it exists
        if (applicationsChannel) {
            await applicationsChannel.send({
                content: moderatorRole ? `<@&${moderatorRole.id}> New application submitted!` : 'New application submitted!',
                embeds: [submissionEmbed]
            });
        }
        
        // Also send to a random moderator's DM if no channel was found
        if (!applicationsChannel && moderators.length > 0) {
            const randomModerator = moderators[Math.floor(Math.random() * moderators.length)];
            try {
                await randomModerator.send({
                    content: 'New application submitted!',
                    embeds: [submissionEmbed]
                });
            } catch (dmError) {
                console.error('Failed to send application to moderator DM:', dmError);
            }
        }
        
        // Clear application data
        await clearTempApplicationData(interaction.user.id);
        
        // Acknowledge submission
        await interaction.update({
            content: 'Your application has been submitted successfully! A staff member will review it and contact you if necessary.',
            embeds: [],
            components: []
        });
        
    } catch (error) {
        console.error('Error submitting application:', error);
        await interaction.reply({
            content: 'An error occurred while submitting your application. Please try again later.',
            ephemeral: true
        });
    }
}
