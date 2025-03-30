# Setting Up UptimeRobot for 24/7 Bot Uptime

This guide will help you set up UptimeRobot to keep your Discord bot running 24/7 on Replit.

## Why UptimeRobot?

Replit projects go to sleep after a period of inactivity. UptimeRobot helps prevent this by periodically pinging your bot's web server, keeping it awake.

## Instructions

1. **Sign up for UptimeRobot**:
   - Visit [UptimeRobot](https://uptimerobot.com/) and create a free account
   - The free tier allows up to 50 monitors with 5-minute check intervals

2. **Get Your Bot's URL**:
   - When your bot starts, it will display a URL in the console log
   - The URL should look something like: `https://your-bot-name.username.repl.co`
   - If you don't see the URL, make sure your bot is running with the keep-alive server enabled

3. **Create a New Monitor**:
   - Log in to UptimeRobot
   - Click "Add New Monitor"
   - Select "HTTP(s)" as the monitor type
   - Enter a friendly name (e.g., "Buckingham Palace Discord Bot")
   - Enter your bot's URL in the URL field
   - Set the monitoring interval to 5 minutes (or your preferred interval)
   - Click "Create Monitor"

4. **Verify Setup**:
   - After creating the monitor, UptimeRobot will begin checking your bot
   - Wait a few minutes and check if the status shows as "Up"
   - If it shows "Down," verify that your bot is running and the URL is correct

## Keep-Alive Configuration

Your bot already has keep-alive functionality built in. Make sure these features are enabled:

1. **Environment Variables**:
   - In your `.env` file, ensure these settings are enabled:
     ```
     KEEP_ALIVE=true
     AUTO_PING=true
     ```

2. **Express Server**:
   - The bot runs an Express server on port 5000 by default
   - This server responds to HTTP requests, which UptimeRobot uses to check if your bot is online

3. **Auto-Ping Feature**:
   - If enabled, the bot will periodically ping itself to prevent Replit from putting it to sleep
   - This works alongside UptimeRobot for extra reliability

## Troubleshooting

If you're having issues with UptimeRobot:

1. **Check Server Status**:
   - Run `node status-check.js` to verify your bot's server is responding correctly

2. **Verify Port Configuration**:
   - Make sure the bot is using the correct port (5000)
   - Ensure the port is accessible from external requests

3. **Replit Sleep Mode**:
   - If your Replit project is on a free plan, it may still go to sleep despite pinging
   - Consider upgrading to a paid Replit plan for more reliable uptime

4. **Multiple Monitors**:
   - For extra reliability, you can set up multiple monitors in UptimeRobot
   - Try monitoring both HTTP and ping type monitors

## Limitations

- UptimeRobot pings are limited to every 5 minutes on the free plan
- Replit may still put your bot to sleep during periods of high server load
- Free Replit projects have monthly computational limits