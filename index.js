// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const token = process.env.TOKEN || require('./config.json').token;
const { 
    getUserVerification, 
    getRobloxGroupSettings, 
    getGuildSettings, 
    getVerifiedUser, 
    updateGuildUserNickname 
} = require('./utils/database');
const { getUserGroupRank, isUserInGroup, formatDisplayName } = require('./utils/robloxApi');
const keepAlive = require('./keep-alive');

// Set global variables for connection status
global.discordClientConnected = false;
global.lastConnectedTimestamp = 0;

// Create a new client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel, // Required for DM support
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ] 
});

// Collection for commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Scheduled task for role and nickname synchronization
async function scheduledRoleSync() {
    try {
        console.log('Running scheduled synchronization for roles and nicknames...');
        const allGuilds = client.guilds.cache;
        
        // Process each guild
        for (const [guildId, guild] of allGuilds) {
            try {
                console.log(`Syncing data for guild: ${guild.name} (${guildId})`);
                
                // Get guild settings
                const guildSettings = await getGuildSettings(guildId);
                const visitorRoleName = guildSettings.visitorRole || 'Visitor';
                const visitorRole = guild.roles.cache.find(role => role.name === visitorRoleName);
                
                // Get group settings for role mapping
                const groupSettings = await getRobloxGroupSettings(guildId);
                const groupEnabled = groupSettings.enabled && groupSettings.groupId && 
                                    groupSettings.roleMapping && Object.keys(groupSettings.roleMapping).length > 0;
                
                // Fetch all members (this might take time for large servers)
                await guild.members.fetch();
                const members = guild.members.cache;
                
                let rolesUpdated = 0;
                let nicknamesUpdated = 0;
                
                // Process each member
                for (const [memberId, member] of members) {
                    if (member.user.bot) continue; // Skip bots
                    
                    // Get verified user data from PostgreSQL first
                    const verifiedUser = await getVerifiedUser(memberId);
                    
                    // If not found in PostgreSQL, check file-based storage
                    const userData = verifiedUser ? 
                        { 
                            verified: true, 
                            robloxId: verifiedUser.roblox_id, 
                            robloxUsername: verifiedUser.roblox_username 
                        } : 
                        await getUserVerification(memberId);
                    
                    if (userData && userData.verified) {
                        // Skip role sync if group integration is not enabled
                        if (!groupEnabled) {
                            // Update nicknames to match Roblox username only (without rank)
                            if (userData.robloxUsername && member.displayName !== userData.robloxUsername) {
                                try {
                                    await member.setNickname(userData.robloxUsername);
                                    await updateGuildUserNickname(guildId, memberId, true);
                                    nicknamesUpdated++;
                                } catch (nicknameError) {
                                    console.warn(`Could not update nickname for ${member.user.tag}: ${nicknameError.message}`);
                                    // Continue with other operations
                                }
                            }
                            continue;
                        }
                        
                        // Check if user is in the configured Roblox group
                        const isInGroup = await isUserInGroup(userData.robloxId, groupSettings.groupId);
                        
                        if (isInGroup) {
                            // Get user's rank in group
                            const rankInfo = await getUserGroupRank(userData.robloxId, groupSettings.groupId);
                            
                            if (rankInfo) {
                                // Update nickname to include rank
                                const formattedNickname = formatDisplayName(userData.robloxUsername, rankInfo.rankName);
                                if (member.displayName !== formattedNickname) {
                                    try {
                                        await member.setNickname(formattedNickname);
                                        await updateGuildUserNickname(guildId, memberId, true);
                                        nicknamesUpdated++;
                                    } catch (nicknameError) {
                                        console.warn(`Could not update nickname for ${member.user.tag}: ${nicknameError.message}`);
                                    }
                                }
                                
                                // If there's a role mapping for this rank, assign the Discord role
                                if (rankInfo.rankId && groupSettings.roleMapping[rankInfo.rankId]) {
                                    // Get Discord role
                                    const discordRoleId = groupSettings.roleMapping[rankInfo.rankId];
                                    const discordRole = guild.roles.cache.get(discordRoleId);
                                    
                                    if (discordRole && !member.roles.cache.has(discordRole.id)) {
                                        // Assign the role if they don't have it
                                        await member.roles.add(discordRole);
                                        
                                        // Remove visitor role if needed
                                        if (visitorRole && member.roles.cache.has(visitorRole.id) && visitorRole.id !== discordRole.id) {
                                            await member.roles.remove(visitorRole);
                                        }
                                        
                                        rolesUpdated++;
                                    }
                                }
                            } else {
                                // If not in group or no rank info, just use Roblox username
                                if (userData.robloxUsername && member.displayName !== userData.robloxUsername) {
                                    try {
                                        await member.setNickname(userData.robloxUsername);
                                        await updateGuildUserNickname(guildId, memberId, true);
                                        nicknamesUpdated++;
                                    } catch (nicknameError) {
                                        console.warn(`Could not update nickname for ${member.user.tag}: ${nicknameError.message}`);
                                    }
                                }
                            }
                        }
                    }
                }
                
                console.log(`Updated ${rolesUpdated} roles and ${nicknamesUpdated} nicknames in guild: ${guild.name}`);
                
            } catch (error) {
                console.error(`Error syncing data for guild ${guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in scheduled synchronization:', error);
    }
}

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Connection state tracking events
client.on(Events.ShardError, error => {
    console.error('A websocket connection encountered an error:', error);
    global.discordClientConnected = false;
});

client.on(Events.ShardDisconnect, (event) => {
    console.warn('Discord websocket disconnected:', event.code, event.reason);
    global.discordClientConnected = false;
});

client.on(Events.ShardReconnecting, () => {
    console.log('Discord websocket reconnecting...');
    global.discordClientConnected = false;
});

client.on(Events.ShardResume, () => {
    console.log('Discord websocket resumed');
    global.discordClientConnected = true;
    global.lastConnectedTimestamp = Date.now();
});

client.on(Events.ShardReady, () => {
    console.log('Shard is ready');
    global.discordClientConnected = true;
    global.lastConnectedTimestamp = Date.now();
});

// When the client is ready, set up scheduled tasks
client.once(Events.ClientReady, () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    global.discordClientConnected = true;
    global.lastConnectedTimestamp = Date.now();
    
    // Initialize database (function called from database.js on import)
    console.log('Database initialized!');
    
    // Run initial role sync after 1 minute to allow for bot to connect to all servers
    setTimeout(scheduledRoleSync, 60 * 1000);
    
    // Set up scheduled role sync (every 6 hours)
    setInterval(scheduledRoleSync, 6 * 60 * 60 * 1000);
    
    // Setup connection status pings
    setInterval(() => {
        if (client.ws.status === 0) { // 0 = WebSocket.OPEN
            global.discordClientConnected = true;
            if (!global.lastConnectedTimestamp) {
                global.lastConnectedTimestamp = Date.now();
            }
        } else {
            global.discordClientConnected = false;
        }
    }, 30 * 1000); // Check every 30 seconds
});

// Start the Keep Alive server
keepAlive();

// Log in to Discord
client.login(token);
