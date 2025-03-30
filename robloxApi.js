const noblox = require('noblox.js');

// Initialize the Roblox client with our cookie when the bot starts
let robloxAuthenticated = false;
async function initializeRobloxClient() {
    try {
        const cookie = process.env.ROBLOX_COOKIE;
        if (!cookie) {
            console.log('No Roblox cookie found. Rank management features will be disabled.');
            return false;
        }
        
        await noblox.setCookie(cookie);
        const currentUser = await noblox.getCurrentUser();
        console.log(`Logged into Roblox as: ${currentUser.UserName} (${currentUser.UserID})`);
        robloxAuthenticated = true;
        return true;
    } catch (error) {
        console.error('Failed to authenticate with Roblox:', error);
        return false;
    }
}

// Try to initialize when this file is loaded
initializeRobloxClient().catch(console.error);

/**
 * Get a Roblox user by their username
 * @param {string} username - The Roblox username
 * @returns {Promise<Object|null>} Roblox user object or null if not found
 */
async function getRobloxUserByUsername(username) {
    try {
        const userId = await noblox.getIdFromUsername(username);
        if (!userId) return null;
        
        const userInfo = await noblox.getUsernameFromId(userId);
        
        return {
            id: userId,
            username: userInfo
        };
    } catch (error) {
        console.error('Error getting Roblox user:', error);
        return null;
    }
}

/**
 * Verify a Roblox user by checking if the verification code is in their profile
 * @param {number} robloxId - The Roblox user ID
 * @param {string} code - The verification code
 * @returns {Promise<boolean>} Whether the verification was successful
 */
async function verifyRobloxUser(robloxId, code) {
    try {
        // Get the user profile
        const profile = await noblox.getPlayerInfo(robloxId);
        
        // Check if the verification code is in the description
        if (profile && profile.blurb && profile.blurb.includes(code)) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error verifying Roblox user:', error);
        return false;
    }
}

/**
 * Get detailed Roblox user information
 * @param {number} robloxId - The Roblox user ID
 * @returns {Promise<Object|null>} Detailed Roblox user information or null if not found
 */
async function getRobloxUserInfo(robloxId) {
    try {
        const userInfo = await noblox.getPlayerInfo(robloxId);
        return userInfo;
    } catch (error) {
        console.error('Error getting Roblox user info:', error);
        return null;
    }
}

/**
 * Get user's rank in a specific Roblox group
 * @param {number} robloxId - The Roblox user ID
 * @param {number} groupId - The Roblox group ID
 * @returns {Promise<Object|null>} Group rank information or null if error/not in group
 */
async function getUserGroupRank(robloxId, groupId) {
    try {
        // Get user's group info
        const groupInfo = await noblox.getGroups(parseInt(robloxId));
        if (!groupInfo || !groupInfo.length) return null;
        
        // Find the specific group
        const targetGroup = groupInfo.find(g => g.Id === parseInt(groupId) || g.id === parseInt(groupId));
        if (!targetGroup) return null;
        
        return {
            rankId: targetGroup.Rank || targetGroup.rank,
            rankName: targetGroup.Role || targetGroup.role,
            groupName: targetGroup.Name || targetGroup.name
        };
    } catch (error) {
        console.error('Error getting user group rank:', error);
        return null;
    }
}

/**
 * Get all ranks in a Roblox group
 * @param {number} groupId - The Roblox group ID
 * @returns {Promise<Array|null>} Array of group ranks or null if error
 */
async function getGroupRanks(groupId) {
    try {
        const roles = await noblox.getRoles(parseInt(groupId));
        return roles.map(role => ({
            id: role.rank,
            name: role.name
        }));
    } catch (error) {
        console.error('Error getting group ranks:', error);
        return null;
    }
}

/**
 * Check if a user is in a specific Roblox group
 * @param {number} robloxId - The Roblox user ID
 * @param {number} groupId - The Roblox group ID
 * @returns {Promise<boolean>} Whether the user is in the group
 */
async function isUserInGroup(robloxId, groupId) {
    try {
        const rank = await noblox.getRankInGroup(parseInt(groupId), parseInt(robloxId));
        return rank > 0;
    } catch (error) {
        console.error('Error checking if user is in group:', error);
        return false;
    }
}

/**
 * Promote a user in a specific Roblox group
 * @param {number} robloxId - The Roblox user ID to promote
 * @param {number} groupId - The Roblox group ID
 * @returns {Promise<Object|null>} New rank information or null if error
 */
async function promoteUserInGroup(robloxId, groupId) {
    if (!robloxAuthenticated) {
        console.error('Cannot promote user - Roblox client is not authenticated');
        return null;
    }
    
    try {
        // Check if user is in the group first
        const currentRank = await noblox.getRankInGroup(parseInt(groupId), parseInt(robloxId));
        if (currentRank === 0) {
            return { success: false, error: 'User is not in the group' };
        }
        
        // Get the rank information before promotion
        const oldRankInfo = await getUserGroupRank(robloxId, groupId);
        
        // Promote the user
        await noblox.changeRank(parseInt(groupId), parseInt(robloxId), 1); // 1 = promote by 1 rank
        
        // Get the updated rank information
        const newRankInfo = await getUserGroupRank(robloxId, groupId);
        
        return { 
            success: true, 
            oldRank: oldRankInfo, 
            newRank: newRankInfo 
        };
    } catch (error) {
        console.error('Error promoting user in group:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set specific rank for a user in a Roblox group
 * @param {number} robloxId - The Roblox user ID
 * @param {number} groupId - The Roblox group ID
 * @param {number} rankId - The rank ID to set
 * @returns {Promise<Object|null>} New rank information or null if error
 */
async function setUserRank(robloxId, groupId, rankId) {
    if (!robloxAuthenticated) {
        console.error('Cannot set user rank - Roblox client is not authenticated');
        return null;
    }
    
    try {
        // Get the rank information before change
        const oldRankInfo = await getUserGroupRank(robloxId, groupId);
        
        // Set the user's rank
        await noblox.setRank(parseInt(groupId), parseInt(robloxId), parseInt(rankId));
        
        // Get the updated rank information
        const newRankInfo = await getUserGroupRank(robloxId, groupId);
        
        return { 
            success: true, 
            oldRank: oldRankInfo, 
            newRank: newRankInfo 
        };
    } catch (error) {
        console.error('Error setting user rank in group:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Format a display name with Roblox username and rank information
 * @param {string} robloxUsername - The Roblox username
 * @param {string} rankName - The rank name in the group
 * @returns {string} Formatted name
 */
function formatDisplayName(robloxUsername, rankName) {
    return `${robloxUsername} [${rankName}]`;
}

module.exports = {
    getRobloxUserByUsername,
    verifyRobloxUser,
    getRobloxUserInfo,
    getUserGroupRank,
    getGroupRanks,
    isUserInGroup,
    promoteUserInGroup,
    setUserRank,
    formatDisplayName,
    isRobloxAuthenticated: () => robloxAuthenticated
};
