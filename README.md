# Buckingham Palace Roblox Discord Bot

A powerful Discord bot tailored for the Buckingham Palace Roblox server, offering comprehensive community management and advanced Roblox integration with robust moderation capabilities.

## Features

- **Welcome System**: Customizable welcome messages for new server members
- **Verification System**: Link Discord accounts to Roblox with verification code
- **Ticket System**: Easy support ticket creation and management
- **Application System**: Custom application forms with multi-step process
- **Role Management**: Automatic role assignment based on Roblox group ranks
- **Moderation Tools**: Link filtering and raid detection
- **Username Synchronization**: Discord username updated to match Roblox username
- **Group Rank Management**: Promote users directly from Discord

## Commands

| Command | Description |
| --- | --- |
| `/setup welcome [channel]` | Set up welcome messages in specified channel |
| `/change welcome message [text]` | Change the welcome message text |
| `/send ticket [channel]` | Create ticket button in specified channel |
| `/apply [type]` | Start an application for a specific role |
| `/create application` | Create a new application form |
| `/verify [roblox-username]` | Link Discord account to Roblox account |
| `/grouproles setup` | Set up Roblox group role integration |
| `/grouproles map [rank] [role]` | Map Roblox group rank to Discord role |
| `/promote [roblox-username] [rank]` | Promote user in Roblox group |
| `/update` | Update Discord nickname (for moderators) |
| `/syncroles` | Manually sync Discord roles with Roblox ranks |

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `config.json` file using the example template:
   ```
   cp config.example.json config.json
   ```
4. Edit `config.json` with your Discord bot token and client ID
5. Set up environment variables in `.env` file:
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
6. Register slash commands:
   ```
   node deploy-commands.js
   ```
7. Start the bot:
   ```
   node index.js
   ```

For 24/7 uptime, see the `setup-uptime-robot.md` guide.

## System Requirements

- Node.js v16.9.0 or higher
- NPM v7 or higher
- Optional: PostgreSQL database (falls back to file storage)

## Database Configuration

The bot supports both PostgreSQL and file-based storage:
- Configure PostgreSQL via the `DATABASE_URL` in `.env`
- If database connection fails, the bot will automatically fall back to file-based storage

## Roblox Integration

For full Roblox functionality (role synchronization, verification):
1. Set the `ROBLOX_COOKIE` in your `.env` file with a valid `.ROBLOSECURITY` cookie
2. Use `/grouproles setup` to configure your Roblox group ID
3. Use `/grouproles map` to connect Roblox ranks to Discord roles

## Keep-Alive System

The bot includes a robust keep-alive system:
- Express server on port 5000
- Self-pinging mechanism
- Watchdog process to monitor and restart the bot if needed

## Management Tools

- `start.js`: Script to manage bot and watchdog processes
- `status-check.js`: Diagnostic tool to check bot health

## Development and Contributions

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.