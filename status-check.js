// Status checker script for Discord Bot
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');

console.log('============================================');
console.log('Discord Bot Status Checker');
console.log('============================================');
console.log('');

// Check if config.json exists
let configContent = {};
try {
  const configFile = fs.readFileSync('./config.json', 'utf8');
  configContent = JSON.parse(configFile);
  console.log('CONFIG FILE:');
  console.log(`config.json: Exists and valid ✓`);
  
  if (!configContent.token || configContent.token === '') {
    console.log(`token: Missing or empty ✗`);
  } else {
    console.log(`token: Present ✓`);
  }
  
  if (!configContent.clientId || configContent.clientId === '') {
    console.log(`clientId: Missing or empty ✗`);
  } else {
    console.log(`clientId: Present ✓`);
  }
} catch (err) {
  console.log('CONFIG FILE:');
  console.log(`config.json: ${err.code === 'ENOENT' ? 'Missing ✗' : 'Invalid JSON ✗'}`);
}

// Check environment variables
console.log('');
console.log('ENVIRONMENT VARIABLES:');
console.log(`TOKEN: ${process.env.TOKEN ? 'Present ✓' : 'Missing ✗'}`);
console.log(`CLIENT_ID: ${process.env.CLIENT_ID ? 'Present ✓' : 'Missing ✗'}`);
console.log(`ROBLOX_COOKIE: ${process.env.ROBLOX_COOKIE ? 'Present ✓' : 'Missing ✗'}`);
console.log(`KEEP_ALIVE: ${process.env.KEEP_ALIVE === 'true' ? 'Enabled ✓' : 'Disabled ✗'}`);
console.log(`AUTO_PING: ${process.env.AUTO_PING === 'true' ? 'Enabled ✓' : 'Disabled ✗'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Present ✓' : 'Missing ✗'}`);

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

// Check running processes
console.log('');
console.log('PROCESSES:');

exec('ps aux | grep "node index.js" | grep -v grep', (error, stdout) => {
  console.log(`Main Bot Process: ${stdout ? 'Running ✓' : 'Not Running ✗'}`);
  
  exec('ps aux | grep "node watchdog.js" | grep -v grep', (error, watchdogStdout) => {
    console.log(`Watchdog Process: ${watchdogStdout ? 'Running ✓' : 'Not Running ✗'}`);
    
    // Function to check server status on a given port
    function checkStatusEndpoint(port, callback) {
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
            
            callback(true);
          } catch (e) {
            console.log('');
            console.log('EXPRESS SERVER:');
            console.log(`Status: Running but returned invalid JSON ✗`);
            console.log(`Error: ${e.message}`);
            callback(false);
          }
        });
      });
      
      req.on('error', () => {
        if (port === 8080) {
          // Try backup port
          checkStatusEndpoint(5000, callback);
        } else {
          console.log('');
          console.log('EXPRESS SERVER:');
          console.log(`Status: Not running or not responding on any port ✗`);
          callback(false);
        }
      });
      
      req.setTimeout(3000, () => {
        req.abort();
        if (port === 8080) {
          // Try backup port
          checkStatusEndpoint(5000, callback);
        } else {
          console.log('');
          console.log('EXPRESS SERVER:');
          console.log(`Status: Not responding on any port (timeout) ✗`);
          callback(false);
        }
      });
    }
    
    // Check database connection
    function checkDatabaseConnection() {
      if (process.env.DATABASE_URL) {
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        
        pool.query('SELECT NOW()', (err, res) => {
          console.log('');
          console.log('DATABASE:');
          if (err) {
            console.log(`PostgreSQL Connection: Failed ✗`);
            console.log(`Error: ${err.message}`);
          } else {
            console.log(`PostgreSQL Connection: Successful ✓`);
            console.log(`Server Time: ${res.rows[0].now}`);
          }
          pool.end();
          
          // Check data files as fallback
          checkDataFiles();
        });
      } else {
        console.log('');
        console.log('DATABASE:');
        console.log(`PostgreSQL Connection: Not configured ✗`);
        
        // Check data files as primary storage
        checkDataFiles();
      }
    }
    
    // Check data files
    function checkDataFiles() {
      console.log('');
      console.log('DATA FILES:');
      console.log(`data/ directory: ${fs.existsSync('./data') ? 'Exists ✓' : 'Missing ✗'}`);
      
      if (fs.existsSync('./data')) {
        console.log(`guildSettings.json: ${fs.existsSync('./data/guildSettings.json') ? 'Exists ✓' : 'Missing ✗'}`);
        console.log(`verifications.json: ${fs.existsSync('./data/verifications.json') ? 'Exists ✓' : 'Missing ✗'}`);
        console.log(`applications.json: ${fs.existsSync('./data/applications.json') ? 'Exists ✓' : 'Missing ✗'}`);
      }
      
      // Show recommendations
      showRecommendations(stdout, watchdogStdout);
    }
    
    // Show recommendations
    function showRecommendations(isMainRunning, isWatchdogRunning) {
      console.log('');
      console.log('============================================');
      console.log('RECOMMENDATIONS:');
      
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
      
      if (!isMainRunning) {
        console.log('- Start the main bot with: node index.js');
      }
      
      if (!isWatchdogRunning && process.env.KEEP_ALIVE === 'true') {
        console.log('- Start the watchdog with: node watchdog.js');
      }
      
      console.log('');
      console.log('If experiencing "Application did not respond" errors:');
      console.log('1. Make sure both processes (index.js and watchdog.js) are running');
      console.log('2. Verify your Internet connection and Discord API status');
      console.log('3. Set up UptimeRobot to ping your Replit URL (see setup-uptime-robot.md)');
      console.log('4. Check Discord Developer Portal for token validity');
      console.log('============================================');
    }
    
    // Start the checks
    checkStatusEndpoint(8080, (serverRunning) => {
      if (serverRunning) {
        checkDatabaseConnection();
      } else {
        checkDatabaseConnection();
      }
    });
  });
});