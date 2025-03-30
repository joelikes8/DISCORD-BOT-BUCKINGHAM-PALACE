# Contributing to Buckingham Palace Roblox Discord Bot

Thank you for considering contributing to this project! Here are some guidelines to help you get started.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/buckingham-palace-discord-bot.git`
3. Install dependencies: `npm install`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

## Development Environment Setup

1. Create a `.env` file using the guidelines in the README
2. Create a `config.json` file based on the `config.example.json` template
3. For testing, you'll need:
   - A Discord bot token
   - A Discord server with appropriate permissions
   - Optional: A Roblox security cookie for testing group functionality

## Making Changes

1. Keep your changes focused on a single issue or feature
2. Write clean, readable code with appropriate comments
3. Test your changes thoroughly
4. Follow the existing code style and structure

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Make sure all tests pass and the bot runs without errors
3. Submit your pull request with a clear description of the changes
4. Be responsive to feedback and questions

## Adding New Commands

When adding new commands:
1. Create a new file in the `commands` directory
2. Follow the existing command structure pattern
3. Register the command in `deploy-commands.js`
4. Update documentation if necessary

## Testing

Before submitting a pull request:
1. Test all affected functionality
2. Ensure backward compatibility
3. Check for any security implications

## Database Changes

When making changes to the database structure:
1. Ensure backward compatibility or provide migration scripts
2. Test both PostgreSQL and file-based storage modes

## Questions?

If you have any questions about contributing, please open an issue to discuss your ideas.