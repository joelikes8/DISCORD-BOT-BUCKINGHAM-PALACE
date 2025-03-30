# Installation Guide

This guide provides detailed steps for installing and configuring the Buckingham Palace Roblox Discord Bot.

## Prerequisites

Before installing the bot, make sure you have:

1. **Node.js**: Version 16.9.0 or higher
2. **NPM**: Version 7 or higher
3. **Discord Bot**: Created through the [Discord Developer Portal](https://discord.com/developers/applications)
4. **Roblox Account**: For group rank integration (optional)
5. **PostgreSQL Database**: For persistent storage (optional)

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/buckingham-palace-discord-bot.git
cd buckingham-palace-discord-bot
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Create Configuration Files

### Create config.json

Copy the example configuration file:

```bash
cp config.example.json config.json
```

Edit `config.json` with your Discord bot token and client ID:

```json
{
  "token": "your_discord_bot_token_here",
  "clientId": "your_discord_application_id_here"
}
```

### Create .env File

Create a `.env` file in the root directory:

```
# Discord Bot Configuration
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id

# Roblox Integration
ROBLOX_COOKIE=your_roblox_security_cookie

# Keep-Alive Settings
KEEP_ALIVE=true
AUTO_PING=true

# Database Connection (optional)
DATABASE_URL=your_postgres_database_url
```

## Step 4: Register Slash Commands

Deploy the bot's slash commands to Discord:

```bash
node deploy-commands.js
```

## Step 5: Start the Bot

Start the main bot process:

```bash
node index.js
```

For production environments, it's recommended to use the start script which handles both the bot and watchdog processes:

```bash
node start.js
```

## Step 6: Configure Bot Settings in Discord

After inviting the bot to your server, use the following commands to configure it:

1. Set up welcome messages:
   ```
   /setup welcome #your-welcome-channel
   ```

2. Customize the welcome message:
   ```
   /change welcome message Your custom welcome message here
   ```

3. Set up Roblox group integration:
   ```
   /grouproles setup your_group_id
   ```

4. Map Roblox ranks to Discord roles:
   ```
   /grouproles map "Rank Name" @RoleName
   ```

## Step 7: Set Up 24/7 Uptime (Optional)

For 24/7 uptime on platforms like Replit, follow the instructions in the [setup-uptime-robot.md](../setup-uptime-robot.md) guide.

## PostgreSQL Database Setup (Optional)

If you're using PostgreSQL for persistent storage:

1. Create a PostgreSQL database
2. Set the `DATABASE_URL` environment variable in your `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database
   ```

The bot will automatically fall back to file-based storage if the database connection fails.

## Troubleshooting

If you encounter issues:

1. Check that all environment variables are correctly set
2. Verify that the bot has proper permissions in your Discord server
3. Run the status check tool to diagnose any problems:
   ```bash
   node status-check.js
   ```
4. Check the logs folder for detailed error messages