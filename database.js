const fs = require('fs').promises;
const path = require('path');

// In-memory storage
const database = {
    guildSettings: {},
    verifications: {},
    applications: {},
    tempApplicationData: {},
    raidDetection: {
        recentMessages: [],
        lastCheck: Date.now()
    }
};

// File paths
const DATA_DIR = './data';
const GUILD_SETTINGS_FILE = path.join(DATA_DIR, 'guildSettings.json');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'verifications.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

// PostgreSQL client for persistent database storage
const { Pool } = require('pg');
let pool = null;
let databaseAvailable = false;

// Only initialize the pool if DATABASE_URL is available
if (process.env.DATABASE_URL) {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        databaseAvailable = true;
    } catch (error) {
        console.error('Error initializing database pool:', error);
        databaseAvailable = false;
    }
} else {
    console.log('No DATABASE_URL environment variable found. Using file-based storage only.');
}

// Initialize database tables
async function initDatabase() {
    // Skip database initialization if no pool is available
    if (!pool) {
        console.log('No database pool available. Using file-based storage only.');
        databaseAvailable = false;
        return;
    }

    try {
        // Check if tables exist and create them if they don't
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'verified_users'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('Creating database tables...');
            
            // Create verified users table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS verified_users (
                    id SERIAL PRIMARY KEY,
                    discord_id TEXT NOT NULL UNIQUE,
                    roblox_id BIGINT NOT NULL,
                    roblox_username TEXT NOT NULL,
                    verification_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    verified BOOLEAN DEFAULT TRUE
                );
            `);
            
            // Create guild users table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS guild_users (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    discord_id TEXT NOT NULL,
                    nickname_changed BOOLEAN DEFAULT FALSE,
                    roles_synced BOOLEAN DEFAULT FALSE,
                    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(guild_id, discord_id)
                );
            `);
            
            console.log('Database tables created successfully');
        }
        
        // Database is available
        databaseAvailable = true;
        console.log('Database initialized!');
        
    } catch (error) {
        console.error('Error initializing database:', error);
        // Mark database as unavailable
        databaseAvailable = false;
        console.log('Falling back to file-based storage system');
    }
}

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Load data from files
async function loadData() {
    try {
        await ensureDataDir();
        
        // Load guild settings
        try {
            const guildSettingsData = await fs.readFile(GUILD_SETTINGS_FILE, 'utf8');
            database.guildSettings = JSON.parse(guildSettingsData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading guild settings:', error);
            }
            // File doesn't exist yet, initialize with empty object
            database.guildSettings = {};
            await fs.writeFile(GUILD_SETTINGS_FILE, JSON.stringify(database.guildSettings, null, 2));
        }
        
        // Load verifications
        try {
            const verificationsData = await fs.readFile(VERIFICATIONS_FILE, 'utf8');
            database.verifications = JSON.parse(verificationsData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading verifications:', error);
            }
            // File doesn't exist yet, initialize with empty object
            database.verifications = {};
            await fs.writeFile(VERIFICATIONS_FILE, JSON.stringify(database.verifications, null, 2));
        }
        
        // Load applications
        try {
            const applicationsData = await fs.readFile(APPLICATIONS_FILE, 'utf8');
            database.applications = JSON.parse(applicationsData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading applications:', error);
            }
            // File doesn't exist yet, initialize with empty object
            database.applications = {};
            await fs.writeFile(APPLICATIONS_FILE, JSON.stringify(database.applications, null, 2));
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Save data to files
async function saveData() {
    try {
        await ensureDataDir();
        
        // Save guild settings
        await fs.writeFile(GUILD_SETTINGS_FILE, JSON.stringify(database.guildSettings, null, 2));
        
        // Save verifications
        await fs.writeFile(VERIFICATIONS_FILE, JSON.stringify(database.verifications, null, 2));
        
        // Save applications
        await fs.writeFile(APPLICATIONS_FILE, JSON.stringify(database.applications, null, 2));
        
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Initialize data on startup
loadData().catch(console.error);

// Save data periodically (every 5 minutes)
setInterval(() => {
    saveData().catch(console.error);
}, 5 * 60 * 1000);

// Guild settings functions
async function getGuildSettings(guildId) {
    if (!database.guildSettings[guildId]) {
        const config = require('../config.json');
        database.guildSettings[guildId] = { ...config.defaultSettings };
    }
    
    return database.guildSettings[guildId];
}

async function saveGuildSettings(guildId, settings) {
    database.guildSettings[guildId] = settings;
    await saveData();
    return settings;
}

// Roblox Group Role Mapping Functions
async function getRobloxGroupSettings(guildId) {
    const settings = await getGuildSettings(guildId);
    return settings.robloxGroup || { 
        groupId: null, 
        enabled: false, 
        roleMapping: {} 
    };
}

async function saveRobloxGroupSettings(guildId, groupSettings) {
    const settings = await getGuildSettings(guildId);
    settings.robloxGroup = groupSettings;
    return await saveGuildSettings(guildId, settings);
}

async function setRobloxGroupId(guildId, groupId) {
    const groupSettings = await getRobloxGroupSettings(guildId);
    groupSettings.groupId = groupId;
    return await saveRobloxGroupSettings(guildId, groupSettings);
}

async function toggleRobloxGroupIntegration(guildId, enabled) {
    const groupSettings = await getRobloxGroupSettings(guildId);
    groupSettings.enabled = enabled;
    return await saveRobloxGroupSettings(guildId, groupSettings);
}

async function mapRobloxRankToDiscordRole(guildId, robloxRankId, discordRoleId) {
    const groupSettings = await getRobloxGroupSettings(guildId);
    if (!groupSettings.roleMapping) {
        groupSettings.roleMapping = {};
    }
    groupSettings.roleMapping[robloxRankId] = discordRoleId;
    return await saveRobloxGroupSettings(guildId, groupSettings);
}

async function removeRobloxRankMapping(guildId, robloxRankId) {
    const groupSettings = await getRobloxGroupSettings(guildId);
    if (groupSettings.roleMapping && groupSettings.roleMapping[robloxRankId]) {
        delete groupSettings.roleMapping[robloxRankId];
    }
    return await saveRobloxGroupSettings(guildId, groupSettings);
}

// Verification functions
async function getUserVerification(userId) {
    return database.verifications[userId];
}

async function saveUserVerification(userId, verificationData) {
    database.verifications[userId] = verificationData;
    await saveData();
    return verificationData;
}

// Application functions
async function getApplication(guildId, applicationType) {
    if (!database.applications[guildId]) {
        database.applications[guildId] = {};
    }
    
    return database.applications[guildId][applicationType];
}

async function saveApplication(guildId, applicationType, questions) {
    if (!database.applications[guildId]) {
        database.applications[guildId] = {};
    }
    
    database.applications[guildId][applicationType] = {
        questions,
        createdAt: Date.now()
    };
    
    await saveData();
    return database.applications[guildId][applicationType];
}

// Temporary application data functions (not saved to file)
async function getTempApplicationData(userId) {
    return database.tempApplicationData[userId];
}

async function saveTempApplicationData(userId, data) {
    database.tempApplicationData[userId] = data;
    return data;
}

async function clearTempApplicationData(userId) {
    delete database.tempApplicationData[userId];
    return true;
}

// Raid detection functions
function addRecentMessage(message) {
    const now = Date.now();
    
    // Clean up old messages (older than 10 seconds)
    database.raidDetection.recentMessages = database.raidDetection.recentMessages.filter(
        msg => now - msg.timestamp < 10000
    );
    
    // Add the new message
    database.raidDetection.recentMessages.push({
        userId: message.author.id,
        guildId: message.guild.id,
        channelId: message.channel.id,
        content: message.content,
        timestamp: now
    });
    
    // Update last check time
    database.raidDetection.lastCheck = now;
}

function getRecentMessages(guildId) {
    return database.raidDetection.recentMessages.filter(msg => msg.guildId === guildId);
}

// PostgreSQL Verification Functions
async function saveVerifiedUser(discordId, robloxId, robloxUsername) {
    // Always save to the file-based system
    await saveUserVerification(discordId, {
        discordId,
        robloxId,
        robloxUsername,
        verified: true,
        timestamp: Date.now()
    });
    
    // Only try to use PostgreSQL if it's available
    if (databaseAvailable) {
        try {
            // First check if user already exists
            const existingUser = await pool.query(
                'SELECT * FROM verified_users WHERE discord_id = $1',
                [discordId]
            );
            
            if (existingUser.rows.length > 0) {
                // Update existing user
                await pool.query(
                    'UPDATE verified_users SET roblox_id = $1, roblox_username = $2, verification_date = CURRENT_TIMESTAMP, verified = TRUE WHERE discord_id = $3',
                    [robloxId, robloxUsername, discordId]
                );
            } else {
                // Insert new user
                await pool.query(
                    'INSERT INTO verified_users (discord_id, roblox_id, roblox_username) VALUES ($1, $2, $3)',
                    [discordId, robloxId, robloxUsername]
                );
            }
            return true;
        } catch (error) {
            console.error('Error saving verified user to database:', error);
            databaseAvailable = false; // Mark database as unavailable after error
            return true; // Still return true since we saved to file system
        }
    }
    
    return true; // Return true since we saved to file system
}

async function getVerifiedUser(discordId) {
    // Check file-based verification first if database is not available
    if (!databaseAvailable) {
        const fileVerification = await getUserVerification(discordId);
        if (fileVerification && fileVerification.verified) {
            return {
                discord_id: discordId,
                roblox_id: fileVerification.robloxId,
                roblox_username: fileVerification.robloxUsername,
                verified: true
            };
        }
        return null;
    }
    
    // If database is available, try to use it
    try {
        const result = await pool.query(
            'SELECT * FROM verified_users WHERE discord_id = $1 AND verified = TRUE',
            [discordId]
        );
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        // If not found in PostgreSQL, try the file-based system
        const fileVerification = await getUserVerification(discordId);
        if (fileVerification && fileVerification.verified) {
            // Migrate to PostgreSQL for future queries
            await saveVerifiedUser(
                discordId, 
                fileVerification.robloxId, 
                fileVerification.robloxUsername
            );
            return {
                discord_id: discordId,
                roblox_id: fileVerification.robloxId,
                roblox_username: fileVerification.robloxUsername,
                verified: true
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error getting verified user from database:', error);
        databaseAvailable = false; // Mark database as unavailable
        
        // Fall back to file-based system
        const fileVerification = await getUserVerification(discordId);
        if (fileVerification && fileVerification.verified) {
            return {
                discord_id: discordId,
                roblox_id: fileVerification.robloxId,
                roblox_username: fileVerification.robloxUsername,
                verified: true
            };
        }
        
        return null;
    }
}

async function updateGuildUserNickname(guildId, discordId, nicknameChanged) {
    // Skip database update if database is unavailable
    if (!databaseAvailable) {
        return true;
    }
    
    try {
        // Check if user exists in this guild
        const existingUser = await pool.query(
            'SELECT * FROM guild_users WHERE guild_id = $1 AND discord_id = $2',
            [guildId, discordId]
        );
        
        if (existingUser.rows.length > 0) {
            // Update existing record
            await pool.query(
                'UPDATE guild_users SET nickname_changed = $1, last_sync = CURRENT_TIMESTAMP WHERE guild_id = $2 AND discord_id = $3',
                [nicknameChanged, guildId, discordId]
            );
        } else {
            // Insert new record
            await pool.query(
                'INSERT INTO guild_users (guild_id, discord_id, nickname_changed) VALUES ($1, $2, $3)',
                [guildId, discordId, nicknameChanged]
            );
        }
        
        return true;
    } catch (error) {
        console.error('Error updating guild user nickname status:', error);
        databaseAvailable = false; // Mark database as unavailable
        return true; // Still return true to not block bot functionality
    }
}

async function updateGuildUserRoleSync(guildId, discordId, rolesSynced) {
    // Skip database update if database is unavailable
    if (!databaseAvailable) {
        return true;
    }
    
    try {
        // Check if user exists in this guild
        const existingUser = await pool.query(
            'SELECT * FROM guild_users WHERE guild_id = $1 AND discord_id = $2',
            [guildId, discordId]
        );
        
        if (existingUser.rows.length > 0) {
            // Update existing record
            await pool.query(
                'UPDATE guild_users SET roles_synced = $1, last_sync = CURRENT_TIMESTAMP WHERE guild_id = $2 AND discord_id = $3',
                [rolesSynced, guildId, discordId]
            );
        } else {
            // Insert new record
            await pool.query(
                'INSERT INTO guild_users (guild_id, discord_id, roles_synced) VALUES ($1, $2, $3)',
                [guildId, discordId, rolesSynced]
            );
        }
        
        return true;
    } catch (error) {
        console.error('Error updating guild user role sync status:', error);
        databaseAvailable = false; // Mark database as unavailable
        return true; // Still return true to not block bot functionality
    }
}

// Initialize database on startup
initDatabase().catch(console.error);

module.exports = {
    getGuildSettings,
    saveGuildSettings,
    getUserVerification,
    saveUserVerification,
    getApplication,
    saveApplication,
    getTempApplicationData,
    saveTempApplicationData,
    clearTempApplicationData,
    addRecentMessage,
    getRecentMessages,
    // Roblox Group Role Functions
    getRobloxGroupSettings,
    saveRobloxGroupSettings,
    setRobloxGroupId,
    toggleRobloxGroupIntegration,
    mapRobloxRankToDiscordRole,
    removeRobloxRankMapping,
    // PostgreSQL Verification Functions
    saveVerifiedUser,
    getVerifiedUser,
    updateGuildUserNickname,
    updateGuildUserRoleSync
};
