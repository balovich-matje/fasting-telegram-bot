/**
 * /menu Command Handler
 * Shows a menu with all available commands as buttons
 */

const { Markup } = require('telegraf');

// Create the menu keyboard - this is a reply keyboard (not inline)
const menuKeyboard = Markup.keyboard([
  ['🚀 Start Fast', '📊 Status'],
  ['💧 Log Water', '⚖️ Log Weight'],
  ['ℹ️ Fasting Info', '❓ Help']
])
  .resize();

async function menuHandler(ctx) {
  await ctx.reply(
    '📋 *Main Menu*\n\nTap a button to get started:',
    {
      parse_mode: 'Markdown',
      ...menuKeyboard
    }
  );
}

// Function to show menu without sending a new message (for use after other actions)
async function showMenuKeyboard(ctx) {
  await ctx.reply(
    'Use the menu below:',
    {
      parse_mode: 'Markdown',
      ...menuKeyboard
    }
  );
}

module.exports = {
  menuHandler,
  menuKeyboard,
  showMenuKeyboard
};
