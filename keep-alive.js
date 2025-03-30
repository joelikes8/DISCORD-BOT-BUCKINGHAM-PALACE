// Load environment variables
require('dotenv').config();

const express = require('express');
const server = express();
const https = require('https');
const { exec } = require('child_process');

// Main status endpoint
server.all('/', (req, res) => {
  const startTime = process.uptime();
  const uptime = formatUptime(startTime);
  
  res.send(`
    <html>
      <head>
        <title>Buckingham Palace Discord Bot</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .status {
            color: #4CAF50;
            font-weight: bold;
          }
          .title {
            color: #333;
          }
          .info {
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="title">Buckingham Palace Discord Bot</h1>
          <p><span class="status">✅ Bot is running!</span></p>
          <div class="info">
            <p><strong>Uptime:</strong> ${uptime}</p>
            <p>The bot will remain online even when you leave this page.</p>
            <p>To keep the bot running 24/7, use an external service like <a href="https://uptimerobot.com/" target="_blank">UptimeRobot</a> to ping this URL every 5 minutes.</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint for external services to ping
server.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// Status endpoint to check Discord connection
server.get('/status', (req, res) => {
  // Provide current Discord connection status and timestamp
  const status = {
    connected: global.discordClientConnected || false,
    lastConnected: global.lastConnectedTimestamp || 0,
    uptime: process.uptime(),
    timestamp: Date.now()
  };
  
  res.status(200).json(status);
});

// Utility to format uptime nicely
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${secs}s`;
  
  return result;
}

// Self-ping to stay alive
function selfPing(url) {
  // Check if auto-ping is enabled in environment variables
  if (process.env.AUTO_PING !== 'true') {
    console.log('Auto-ping is disabled in .env file. Set AUTO_PING=true to enable.');
    return;
  }
  
  const pingInterval = 4 * 60 * 1000; // 4 minutes (below Replit's 5-minute timeout)
  
  console.log('Auto-ping enabled. Bot will stay alive by self-pinging.');
  
  // Ping the server to keep it alive
  setInterval(() => {
    try {
      https.get(url, (res) => {
        console.log(`Self-ping successful, status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('Self-ping failed:', err.message);
      });
      
      // Also ping UptimeRobot to ensure external monitoring
      https.get('https://uptimerobot.com/', () => {}).on('error', () => {});
    } catch (error) {
      console.error('Error during self-ping:', error);
    }
  }, pingInterval);
  
  // Additional ping at different interval to create irregular pattern
  // This helps avoid Replit's sleep detection mechanisms
  setInterval(() => {
    try {
      https.get(url + '/ping', () => {}).on('error', () => {});
    } catch (error) {}
  }, pingInterval * 0.7);
}

// Check if bot is still running and restart if needed
function monitorBot() {
  // Check if auto-restart is enabled
  if (process.env.KEEP_ALIVE !== 'true') {
    console.log('Bot monitoring is disabled in .env file. Set KEEP_ALIVE=true to enable.');
    return;
  }
  
  console.log('Bot monitoring enabled. Bot will be restarted automatically if it goes offline.');
  
  const checkInterval = 3 * 60 * 1000; // 3 minutes
  let lastRestartAttempt = 0;
  let consecutiveFailures = 0;
  
  setInterval(() => {
    try {
      // First check if Discord.js client is connected
      const isConnected = global.discordClientConnected;
      const currentTime = Date.now();
      
      // Only attempt restart if more than 1 minute since last attempt
      if (!isConnected && (currentTime - lastRestartAttempt > 60000)) {
        console.log('Discord client disconnected, checking process...');
        
        // Then check if process is running
        exec('ps aux | grep "node index.js" | grep -v grep', (error, stdout) => {
          if (!stdout || consecutiveFailures > 2) {
            console.log(`Bot appears to be ${!stdout ? 'not running' : 'unresponsive'}, attempting to restart...`);
            lastRestartAttempt = currentTime;
            consecutiveFailures += 1;
            
            // Kill any existing process first
            exec('pkill -f "node index.js"', () => {
              // Wait a moment and then restart
              setTimeout(() => {
                exec('node index.js > bot.log 2>&1 &', (err) => {
                  if (err) {
                    console.error('Failed to restart bot:', err);
                  } else {
                    console.log('Bot restart initiated');
                  }
                });
              }, 2000);
            });
          }
        });
      } else if (isConnected) {
        // Reset failure counter when connected
        consecutiveFailures = 0;
      }
    } catch (error) {
      console.error('Error during bot monitoring:', error);
    }
  }, checkInterval);
}

function keepAlive() {
  // Use port 8080 as primary, fallback to 5000 or other process.env.PORT if needed
  const PORT = process.env.PORT || 8080;
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is ready on port ${PORT}`);
    
    // If running on Replit, extract the URL from environment
    if (process.env.REPL_ID) {
      // Handle both newer and older Replit environment variable formats
      let replitUrl;
      if (process.env.REPLIT_DEPLOYMENT) {
        replitUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      } else if (process.env.REPLIT_DOMAINS) {
        replitUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
      } else {
        replitUrl = `https://${process.env.REPLIT_SLUG || process.env.REPL_SLUG}.${process.env.REPLIT_OWNER || process.env.REPL_OWNER}.repl.co`;
      }
      console.log(`Replit URL: ${replitUrl}`);
      
      // Start self-pinging
      selfPing(replitUrl);
    }
    
    // Start monitoring the bot
    monitorBot();
  });
}

module.exports = keepAlive;
