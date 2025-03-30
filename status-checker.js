// Load environment variables
require('dotenv').config();

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

console.log('============================================');
console.log('   BUCKINGHAM PALACE DISCORD BOT STATUS     ');
console.log('============================================');
console.log('');

// Check environment variables
console.log('ENVIRONMENT VARIABLES:');
console.log(`TOKEN: ${process.env.TOKEN ? 'Set ✓' : 'Missing ✗'}`);
console.log(`CLIENT_ID: ${process.env.CLIENT_ID ? 'Set ✓' : 'Missing ✗'}`);
console.log(`ROBLOX_COOKIE: ${process.env.ROBLOX_COOKIE ? 'Set ✓' : 'Missing ✗'}`);
console.log(`KEEP_ALIVE: ${process.env.KEEP_ALIVE ? process.env.KEEP_ALIVE : 'Not set'}`);
console.log(`AUTO_PING: ${process.env.AUTO_PING ? process.env.AUTO_PING : 'Not set'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set ✓' : 'Missing ✗'}`);
console.log('');

// Check if config.json exists and contains token and clientId
let configFileStatus = 'Missing ✗';
let configContent = { token: null, clientId: null };
try {
  if (fs.existsSync('./config.json')) {
    configContent = require('./config.json');
    if (configContent.token && configContent.clientId) {
      configFileStatus = 'Valid ✓';
    } else {
      configFileStatus = 'Incomplete ✗';
    }
  }
} catch (err) {
  configFileStatus = `Error: ${err.message}`;
}

console.log('CONFIG FILES:');
console.log(`config.json: ${configFileStatus}`);
console.log(`.env file: ${fs.existsSync('./.env') ? 'Exists ✓' : 'Missing ✗'}`);
console.log('');

// Check if workflows are running
console.log('PROCESSES:');
exec('ps aux | grep "node index.js" | grep -v grep', (error, stdout) => {
  console.log(`Main Bot Process: ${stdout ? 'Running ✓' : 'Not Running ✗'}`);
  
  exec('ps aux | grep "node watchdog.js" | grep -v grep', (error, stdout) => {
    console.log(`Watchdog Process: ${stdout ? 'Running ✓' : 'Not Running ✗'}`);
    
    // Check Express server - try both port 8080 and 5000
    const checkPort = (port) => {
      try {
        const req = http.get(`http://localhost:${port}/status`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const status = JSON.parse(data);
              console.log('');
              console.log('EXPRESS SERVER:');
              console.log(`Status: Running on port ${port} ✓`);
              console.log(`Discord Connection: ${status.connected ? 'Connected ✓' : 'Disconnected ✗'}`);
              if (status.lastConnected) {
                const lastConnected = new Date(status.lastConnected);
                console.log(`Last Connected: ${lastConnected.toLocaleString()}`);
              }
              if (status.uptime) {
                console.log(`Uptime: ${formatUptime(status.uptime)}`);
              }
            
            // Check data files
            console.log('');
            console.log('DATA FILES:');
            console.log(`data/ directory: ${fs.existsSync('./data') ? 'Exists ✓' : 'Missing ✗'}`);
            if (fs.existsSync('./data')) {
              console.log(`guildSettings.json: ${fs.existsSync('./data/guildSettings.json') ? 'Exists ✓' : 'Missing ✗'}`);
              console.log(`verifications.json: ${fs.existsSync('./data/verifications.json') ? 'Exists ✓' : 'Missing ✗'}`);
              console.log(`applications.json: ${fs.existsSync('./data/applications.json') ? 'Exists ✓' : 'Missing ✗'}`);
            }
            
            console.log('');
            console.log('============================================');
            console.log('RECOMMENDATIONS:');
            
            // Provide recommendations based on status
            if (!process.env.TOKEN && (!configContent.token || configContent.token === '')) {
              console.log('- Add your Discord bot token in config.json or .env file');
            }
            
            if (!process.env.CLIENT_ID && (!configContent.clientId || configContent.clientId === '')) {
              console.log('- Add your Discord client ID in config.json or .env file');
            }
            
            if (!process.env.ROBLOX_COOKIE) {
              console.log('- Add your Roblox cookie in .env file to enable Roblox group features');
            }
            
            if (process.env.KEEP_ALIVE !== 'true') {
              console.log('- Set KEEP_ALIVE=true in .env file to enable automatic bot restarts');
            }
            
            if (process.env.AUTO_PING !== 'true') {
              console.log('- Set AUTO_PING=true in .env file to enable self-pinging');
            }
            
            if (!stdout) {
              console.log('- Restart the bot with: node index.js');
            }
            
            console.log('');
            console.log('If experiencing "Application did not respond" errors:');
            console.log('1. Make sure both processes (index.js and watchdog.js) are running');
            console.log('2. Verify your Internet connection and Discord API status');
            console.log('3. Set up UptimeRobot to ping your Replit URL (see setup-uptime-robot.md)');
            console.log('4. Check Discord Developer Portal for token validity');
            console.log('============================================');
          } catch (e) {
            console.log('');
            console.log('EXPRESS SERVER:');
            console.log(`Status: Running but returned invalid JSON ✗`);
            console.log(`Error: ${e.message}`);
          }
        });
      });
      
      req.on('error', (err) => {
        console.log('');
        console.log('EXPRESS SERVER:');
        console.log(`Status: Not running or not responding ✗`);
        console.log(`Error: ${err.message}`);
        
        console.log('');
        console.log('RECOMMENDATIONS:');
        console.log('- Start the bot with: node index.js');
        console.log('- Check if port 5000 is already in use');
        console.log('- Verify your Internet connection');
      });
      
      req.setTimeout(3000, () => {
        req.abort();
        
        // If timeout on port 8080, try port 5000
        if (port === 8080) {
          console.log(`Port ${port} timed out, trying port 5000...`);
          checkPort(5000);
        } else {
          console.log('');
          console.log('EXPRESS SERVER:');
          console.log(`Status: Not responding on any port (timeout) ✗`);
        }
      });
    } catch (err) {
      // If error on port 8080, try port 5000
      if (port === 8080) {
        console.log(`Error checking port ${port}: ${err.message}`);
        console.log('Trying port 5000...');
        checkPort(5000);
      } else {
        console.log('');
        console.log('EXPRESS SERVER:');
        console.log(`Status: Error checking server on all ports ✗`);
        console.log(`Error: ${err.message}`);
      }
    }
  };
  
  // Try both ports
  checkPort(8080);
  });
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