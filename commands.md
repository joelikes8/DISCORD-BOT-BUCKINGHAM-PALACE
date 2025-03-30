# Bot Commands Documentation

This document provides detailed information about all available commands in the Buckingham Palace Roblox Discord Bot.

## Verification Commands

### `/verify [roblox-username]`
Links a Discord account to a Roblox account.

**Parameters:**
- `roblox-username`: The Roblox username to verify with

**Usage Example:**
```
/verify RobloxUser123
```

**Process:**
1. The bot generates a verification code
2. User adds the code to their Roblox profile
3. Bot verifies the code and links the accounts
4. Discord nickname is updated to match Roblox username
5. Appropriate roles are assigned based on Roblox group rank

**Permission:** Everyone

---

## Setup Commands

### `/setup welcome [channel]`
Configures welcome messages for new server members.

**Parameters:**
- `channel`: The channel where welcome messages will be sent

**Usage Example:**
```
/setup welcome #welcome-channel
```

**Permission:** Administrator

### `/grouproles setup`
Sets up the Roblox group integration.

**Parameters:**
- `group-id`: The Roblox group ID to integrate with

**Usage Example:**
```
/grouproles setup 11925205
```

**Permission:** Administrator

### `/grouproles map [rank] [role]`
Maps a Roblox group rank to a Discord role.

**Parameters:**
- `rank`: The Roblox rank ID or name
- `role`: The Discord role to map to

**Usage Example:**
```
/grouproles map "Palace Guard" @PalaceGuard
```

**Permission:** Administrator

---

## Ticket Commands

### `/send ticket [channel]`
Creates a ticket button in the specified channel.

**Parameters:**
- `channel`: The channel to create the ticket button in

**Usage Example:**
```
/send ticket #help-desk
```

**Permission:** Administrator or Moderator

---

## Application Commands

### `/create application`
Creates a new application form.

**Parameters:**
- `type`: Application type/name
- `questions`: The questions for the application (interactive)

**Usage Example:**
```
/create application
```

**Permission:** Administrator or Moderator

### `/apply [type]`
Starts an application process.

**Parameters:**
- `type`: The type of application to start

**Usage Example:**
```
/apply staff
```

**Permission:** Everyone

---

## Management Commands

### `/change welcome message [text]`
Changes the welcome message text.

**Parameters:**
- `text`: The new welcome message text

**Usage Example:**
```
/change welcome message Welcome to Buckingham Palace, {username}!
```

**Permission:** Administrator or Moderator

### `/promote [roblox-username] [rank]`
Promotes a user in the Roblox group.

**Parameters:**
- `roblox-username`: The Roblox username to promote
- `rank`: The rank to promote to

**Usage Example:**
```
/promote RobloxUser123 "Royal Guard"
```

**Permission:** Administrator or Moderator

### `/update`
Updates a user's Discord nickname to match their verified Roblox username.

**Usage Example:**
```
/update
```

**Permission:** Administrator or Moderator (when updating others)

### `/syncroles`
Manually synchronizes Discord roles with Roblox group ranks.

**Usage Example:**
```
/syncroles
```

**Permission:** Administrator or Moderator