/**
 * Buckingham Palace Discord Bot Starter
 * 
 * This script helps manage the Discord bot and its watchdog process.
 * It can start both processes, check their status, and restart them if needed.
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');

// Check if .env file exists, create it if it doesn't
if (!fs.existsSync('./.env')) {
  console.log('Creating default .env file...');
  const defaultEnv = 
`# Discord Bot Configuration
# Replace these with your actual values
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here

# Roblox Integration
ROBLOX_COOKIE=your_roblox_cookie_here

# Keep-Alive Settings (recommended: true)
KEEP_ALIVE=true
AUTO_PING=true

# Webhook for watchdog alerts (optional)
ALERT_WEBHOOK_URL=

# Database Connection
# If not provided, will use file-based storage
# DATABASE_URL=postgres://username:password@hostname:port/database
`;

  fs.writeFileSync('./.env', defaultEnv);
  console.log('Created .env file. Please edit it with your actual configuration values.');
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

// Available commands
const COMMANDS = {
  START: 'start',
  STATUS: 'status',
  STOP: 'stop',
  RESTART: 'restart',
  HELP: 'help',
  WATCHDOG: 'watchdog'
};

// Help message
function showHelp() {
  console.log(`
Buckingham Palace Discord Bot Manager

Usage:
  node start.js [command]

Commands:
  start     - Start both the bot and watchdog processes
  status    - Check the status of bot and watchdog processes
  stop      - Stop all bot processes
  restart   - Restart all bot processes
  watchdog  - Start only the watchdog process
  help      - Show this help message

Examples:
  node start.js start
  node start.js status
  `);
}

// Check if processes are running
function checkProcesses(callback) {
  exec('ps aux | grep "node index.js" | grep -v grep', (error, botOutput) => {
    const botRunning = !!botOutput;
    
    exec('ps aux | grep "node watchdog.js" | grep -v grep', (error, watchdogOutput) => {
      const watchdogRunning = !!watchdogOutput;
      callback(botRunning, watchdogRunning);
    });
  });
}

// Start the bot process
function startBot() {
  console.log('Starting Discord bot...');
  const bot = spawn('node', ['index.js'], {
    detached: true,
    stdio: 'ignore'
  });
  
  bot.unref();
  console.log('Bot started! (Process ID:', bot.pid, ')');
}

// Start the watchdog process
function startWatchdog() {
  console.log('Starting watchdog process...');
  const watchdog = spawn('node', ['watchdog.js'], {
    detached: true,
    stdio: 'ignore'
  });
  
  watchdog.unref();
  console.log('Watchdog started! (Process ID:', watchdog.pid, ')');
}

// Stop all bot processes
function stopProcesses(callback) {
  console.log('Stopping all bot processes...');
  exec('pkill -f "node index.js"', () => {
    exec('pkill -f "node watchdog.js"', () => {
      console.log('All processes stopped.');
      if (callback) callback();
    });
  });
}

// Process commands
switch (command) {
  case COMMANDS.START:
    checkProcesses((botRunning, watchdogRunning) => {
      if (botRunning) {
        console.log('Bot is already running.');
      } else {
        startBot();
      }
      
      if (watchdogRunning) {
        console.log('Watchdog is already running.');
      } else {
        startWatchdog();
      }
      
      console.log('\nTip: Run "node status-check.js" to check detailed bot status.');
    });
    break;
    
  case COMMANDS.STATUS:
    console.log('Checking process status...');
    checkProcesses((botRunning, watchdogRunning) => {
      console.log('Bot process:', botRunning ? 'Running ✓' : 'Not running ✗');
      console.log('Watchdog process:', watchdogRunning ? 'Running ✓' : 'Not running ✗');
      console.log('\nFor more detailed status information, run: node status-check.js');
    });
    break;
    
  case COMMANDS.STOP:
    stopProcesses();
    break;
    
  case COMMANDS.RESTART:
    console.log('Restarting all processes...');
    stopProcesses(() => {
      // Wait a moment for processes to fully terminate
      setTimeout(() => {
        startBot();
        startWatchdog();
        console.log('All processes restarted!');
        console.log('\nTip: Run "node status-check.js" to check detailed bot status.');
      }, 2000);
    });
    break;
    
  case COMMANDS.WATCHDOG:
    checkProcesses((botRunning, watchdogRunning) => {
      if (watchdogRunning) {
        console.log('Watchdog is already running.');
      } else {
        startWatchdog();
      }
    });
    break;
    
  case COMMANDS.HELP:
  default:
    showHelp();
    break;
}

// If no command provided, show help
if (!command) {
  showHelp();
}