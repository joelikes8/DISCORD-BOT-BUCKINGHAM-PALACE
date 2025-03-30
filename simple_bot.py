import discord
import os
import time
from flask import Flask
from threading import Thread

# Flask server to keep the bot running
app = Flask('')

@app.route('/')
def home():
    return "Bot is alive!"

def run():
    app.run(host='0.0.0.0', port=5000)

def keep_alive():
    t = Thread(target=run)
    t.start()

# Replace 'YOUR_BOT_TOKEN' with your actual bot token.
BOT_TOKEN = os.getenv('TOKEN') or 'YOUR_BOT_TOKEN'

# Create a client instance for the bot.
intents = discord.Intents.default()
intents.message_content = True  # Enable message content intent
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f'Logged in as {client.user}! The bot is online and ready to go!')
    
    # Set the bot's status
    await client.change_presence(activity=discord.Activity(
        type=discord.ActivityType.watching, 
        name="the Buckingham Palace"
    ))

# Keep the bot running forever with auto-restart
if __name__ == "__main__":
    keep_alive()  # Start the Flask web server
    
    # Run the bot with automatic reconnection
    while True:
        try:
            client.run(BOT_TOKEN)
        except Exception as e:
            print(f"Bot crashed with error: {e}")
            print("Restarting in 5 seconds...")
            time.sleep(5)