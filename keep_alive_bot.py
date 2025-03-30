import discord
import os
from discord.ext import commands
import logging
import threading
from flask import Flask
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Replace 'YOUR_BOT_TOKEN' with your actual bot token.
# You can also set it as an environment variable
BOT_TOKEN = os.getenv('TOKEN') or 'YOUR_BOT_TOKEN'

# Create a client instance for the bot with all intents enabled for better functionality
intents = discord.Intents.all()
client = commands.Bot(command_prefix='!', intents=intents)

# Create a Flask app to keep the bot running
app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is alive!"

def run_flask():
    app.run(host='0.0.0.0', port=5000)

@client.event
async def on_ready():
    logging.info(f'Logged in as {client.user}! The bot is online and ready to go!')
    
    # Set the bot's status
    await client.change_presence(activity=discord.Activity(
        type=discord.ActivityType.watching, 
        name="the Buckingham Palace"
    ))
    
    # Log the number of servers the bot is in
    guild_count = len(client.guilds)
    logging.info(f"Bot is in {guild_count} server(s)")
    
    # List server names
    for guild in client.guilds:
        logging.info(f" - {guild.name} (ID: {guild.id})")

@client.command(name="ping")
async def ping(ctx):
    """Check the bot's latency"""
    latency = round(client.latency * 1000)
    await ctx.send(f"Pong! Latency: {latency}ms")

@client.event
async def on_message(message):
    # Don't respond to our own messages
    if message.author == client.user:
        return
    
    # Process commands
    await client.process_commands(message)

# Restart handler - automatically reconnect if disconnected
@client.event
async def on_disconnect():
    logging.warning("Bot disconnected! Attempting to reconnect...")
    # We don't need to manually reconnect as discord.py handles this automatically

# Error handling
@client.event
async def on_error(event, *args, **kwargs):
    logging.error(f"Error in event {event}: {args} {kwargs}")

# Keep the bot running
if __name__ == "__main__":
    # Start the Flask server in a separate thread
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    # Custom retry mechanism with backoff
    while True:
        try:
            logging.info("Starting the bot...")
            client.run(BOT_TOKEN)
        except discord.errors.HTTPException as e:
            if e.status == 429:  # Rate limited
                retry_after = e.retry_after if hasattr(e, 'retry_after') else 60
                logging.warning(f"Rate limited. Retrying in {retry_after} seconds...")
                time.sleep(retry_after)
            else:
                logging.error(f"HTTP Error: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
        except Exception as e:
            logging.error(f"Error: {e}")
            logging.info("Restarting in 30 seconds...")
            time.sleep(30)  # Wait 30 seconds before retrying