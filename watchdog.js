// Load environment variables
require('dotenv').config();

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BOT_SCRIPT = 'index.js';
const LOG_FILE = 'bot.log';
const CHECK_INTERVAL = 60 * 1000; // Check every minute
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_ATTEMPT_INTERVAL = 5 * 60 * 1000; // 5 minutes between counting restart attempts
const WEBHOOK_URL = process.env.STATUS_WEBHOOK;

// Track restart attempts
let restartAttempts = 0;
let lastRestartAttempt = 0;

// Setup log directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Function to log to file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  fs.appendFileSync(path.join(logDir, 'watchdog.log'), logMessage);
}

// Function to check if the bot is running
function isBotRunning(callback) {
  // First, check if the process is running
  exec('ps aux | grep "node index.js" | grep -v grep', (error, stdout) => {
    const isProcessRunning = !!stdout;
    
    if (!isProcessRunning) {
      // Process not running at all
      callback(false);
      return;
    }
    
    // Process is running, now check if the Discord gateway connection is active
    // We access the global variable through a simple HTTP request to our keep-alive server
    const http = require('http');
    
    try {
      // Try both port 8080 and 5000 since we updated the server configuration
      const checkPort = (port) => {
        const req = http.get(`http://localhost:${port}/status`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const status = JSON.parse(data);
              // If process is running but not connected to Discord for over 5 minutes
              if (!status.connected && (Date.now() - status.lastConnected > 5 * 60 * 1000)) {
                log('Bot process running but Discord gateway disconnected for over 5 minutes');
                callback(false);
              } else {
                callback(true);
              }
            } catch (e) {
              // If we can't parse the response, assume the bot is running
              callback(true);
            }
          });
        });
        
        req.on('error', () => {
          // If we can't connect on this port, try the other port
          if (port === 8080) {
            log('Could not connect to bot status on port 8080, trying port 5000...');
            checkPort(5000);
          } else {
            // If both ports fail, assume bot is running but web server might be down
            callback(true);
          }
        });
        
        req.setTimeout(3000, () => {
          req.abort();
          // If timeout on this port, try the other port
          if (port === 8080) {
            log('Timeout connecting to port 8080, trying port 5000...');
            checkPort(5000);
          } else {
            callback(true); // Assume running if both ports timeout
          }
        });
      };
      
      // Start with port 8080 first
      checkPort(8080);
    } catch (err) {
      // Fallback to just checking the process
      callback(isProcessRunning);
    }
  });
}

// Function to start the bot
function startBot() {
  // Check if auto-restart is enabled
  if (process.env.KEEP_ALIVE !== 'true') {
    log('Auto-restart is disabled in .env file. Set KEEP_ALIVE=true to enable.');
    return;
  }
  
  const now = Date.now();
  
  // Reset restart counter if it's been more than the restart attempt interval
  if (now - lastRestartAttempt > RESTART_ATTEMPT_INTERVAL) {
    restartAttempts = 0;
  }
  
  // Update last restart time
  lastRestartAttempt = now;
  
  // Increment restart counter
  restartAttempts++;
  
  // Check if we've reached the max restart attempts
  if (restartAttempts > MAX_RESTART_ATTEMPTS) {
    log(`Maximum restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Waiting for manual intervention.`);
    
    // Try to send alert via webhook if configured
    if (WEBHOOK_URL) {
      try {
        const https = require('https');
        const data = JSON.stringify({
          content: `⚠️ ALERT: Bot restart failed after ${MAX_RESTART_ATTEMPTS} attempts. Manual intervention required.`
        });
        
        const url = new URL(WEBHOOK_URL);
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };
        
        const req = https.request(options);
        req.write(data);
        req.end();
      } catch (error) {
        log(`Failed to send webhook alert: ${error.message}`);
      }
    }
    
    // Reset after 30 minutes to try again
    setTimeout(() => {
      restartAttempts = 0;
      log('Restart counter reset. Will attempt to restart bot again.');
    }, 30 * 60 * 1000);
    
    return;
  }
  
  log(`Attempting to start bot (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
  
  // Kill any existing node processes that might be running the bot
  exec('pkill -f "node index.js"', () => {
    // Wait a moment to ensure process is fully terminated
    setTimeout(() => {
      // Start the bot with logging
      exec(`node ${BOT_SCRIPT} > ${LOG_FILE} 2>&1 &`, (error) => {
        if (error) {
          log(`Failed to start bot: ${error.message}`);
        } else {
          log('Bot started successfully.');
          
          // Give the bot some time to connect
          setTimeout(() => {
            isBotRunning((running) => {
              if (running) {
                log('Bot is now running and responding.');
              } else {
                log('Bot started but may not be fully operational yet.');
              }
            });
          }, 30000); // Check after 30 seconds
        }
      });
    }, 2000); // Wait 2 seconds before starting
  });
}

// Main monitoring loop
function startMonitoring() {
  // Check if auto-restart is enabled
  if (process.env.KEEP_ALIVE !== 'true') {
    log('Watchdog monitoring is disabled in .env file. Set KEEP_ALIVE=true to enable.');
    return;
  }
  
  log('Watchdog started. Monitoring bot...');
  
  // Check immediately
  isBotRunning((running) => {
    if (!running) {
      log('Bot not running on startup. Starting it...');
      startBot();
    } else {
      log('Bot is already running.');
    }
  });
  
  // Set up regular interval checks
  setInterval(() => {
    isBotRunning((running) => {
      if (!running) {
        log('Bot is not running. Attempting to restart...');
        startBot();
      }
    });
  }, CHECK_INTERVAL);
}

// Start the watchdog
startMonitoring();