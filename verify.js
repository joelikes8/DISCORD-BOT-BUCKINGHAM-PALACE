const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getRobloxUserByUsername, verifyRobloxUser } = require('../utils/robloxApi');
const { getUserVerification, saveUserVerification, getVerifiedUser, saveVerifiedUser } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)),
    
    async execute(interaction) {
        const robloxUsername = interaction.options.getString('username');
        
        // Check if user is already verified in the SQL database first
        const sqlVerification = await getVerifiedUser(interaction.user.id);
        if (sqlVerification) {
            return interaction.editReply({
                content: `You are already verified as Roblox user: ${sqlVerification.roblox_username}`,
                ephemeral: true
            });
        }
        
        // If not in SQL, check the old method
        const existingVerification = await getUserVerification(interaction.user.id);
        if (existingVerification && existingVerification.verified) {
            return interaction.editReply({
                content: `You are already verified as Roblox user: ${existingVerification.robloxUsername}`,
                ephemeral: true
            });
        }
        
        try {
            // Get Roblox user information
            const robloxUser = await getRobloxUserByUsername(robloxUsername);
            
            if (!robloxUser) {
                return interaction.editReply({
                    content: `Could not find a Roblox user with the username: ${robloxUsername}`,
                    ephemeral: true
                });
            }
            
            // Generate a verification code
            const verificationCode = generateVerificationCode();
            
            // Create verification embed
            const verificationEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Roblox Verification')
                .setDescription(`To verify your Roblox account, please follow these steps:
                
                1. Go to your Roblox profile
                2. Add this verification code to your About section: \`${verificationCode}\`
                3. Once added, click the Verify button below
                
                Verification code: \`${verificationCode}\``)
                .setFooter({ text: 'Buckingham Palace Roblox Verification' });
            
            // Create verification button
            const verifyButton = new ButtonBuilder()
                .setCustomId(`verify_roblox_${robloxUser.id}`)
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success);
            
            const row = new ActionRowBuilder()
                .addComponents(verifyButton);
            
            // Store verification data temporarily
            await saveUserVerification(interaction.user.id, {
                robloxId: robloxUser.id,
                robloxUsername: robloxUsername,
                code: verificationCode,
                verified: false,
                timestamp: Date.now()
            });
            
            // Send verification instructions
            return interaction.editReply({
                embeds: [verificationEmbed],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error('Verification error:', error);
            return interaction.editReply({
                content: 'An error occurred while trying to verify your Roblox account. Please try again later.',
                ephemeral: true
            });
        }
    },
};

// Helper function to generate a random verification code
function generateVerificationCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
