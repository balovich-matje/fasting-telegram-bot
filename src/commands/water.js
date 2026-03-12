/**
 * /water Command Handler
 * Logs water intake with various formats supported
 */

const { Markup } = require('telegraf');
const db = require('../database');
const { formatWaterAmount } = require('../calculations');

// Common cup/glass sizes in ml
const CUP_SIZES = {
  'small': 150,
  'cup': 250,
  'glass': 250,
  'mug': 350,
  'bottle': 500,
  'large': 750
};

/**
 * Parse water amount from various input formats
 * @param {string} input - User input
 * @returns {number|null} - Amount in ml or null if invalid
 */
function parseWaterAmount(input) {
  if (!input) return null;
  
  input = input.toLowerCase().trim();
  
  // Check for cup/glass keywords
  for (const [key, size] of Object.entries(CUP_SIZES)) {
    if (input.includes(key)) {
      return size;
    }
  }
  
  // Parse oz (fluid ounces to ml: 1 oz ≈ 29.57 ml)
  const ozMatch = input.match(/^(\d+(?:\.\d+)?)\s*(?:oz|ounces?|fl oz)$/);
  if (ozMatch) {
    return Math.round(parseFloat(ozMatch[1]) * 29.57);
  }
  
  // Parse ml (just number or with ml suffix)
  const mlMatch = input.match(/^(\d+)\s*(?:ml|milliliters?)?$/);
  if (mlMatch) {
    return parseInt(mlMatch[1]);
  }
  
  // Parse liters
  const lMatch = input.match(/^(\d+(?:\.\d+)?)\s*(?:l|liters?|litres?)$/);
  if (lMatch) {
    return Math.round(parseFloat(lMatch[1]) * 1000);
  }
  
  return null;
}

async function waterHandler(ctx) {
  const userId = ctx.from.id;
  
  // Check if user has a profile
  const user = db.users.get(userId);
  if (!user) {
    return ctx.reply(
      '⚠️ You need to set up your profile first.\n\n' +
      'Please use /start to complete the onboarding process.'
    );
  }
  
  // Get the amount from command args
  const args = ctx.message.text.split(' ').slice(1);
  const input = args.join(' ');
  
  if (!input) {
    // No amount provided - show today's total and prompt for input
    const todayTotal = db.water.getTodayTotal(userId);
    const todayLogs = db.water.getTodayLogs(userId);
    
    let message = `
💧 *Water Tracking*\n\n`;
    
    if (todayLogs.length > 0) {
      message += `Today's intake: *${formatWaterAmount(todayTotal)}*\n\n`;
      message += `Recent logs:\n`;
      todayLogs.slice(0, 5).forEach(log => {
        const time = new Date(log.logged_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        message += `• ${time}: ${formatWaterAmount(log.amount_ml)}\n`;
      });
      message += `\n`;
    } else {
      message += `No water logged today.\n\n`;
    }
    
    message += `Reply with an amount:\n` +
      `• *250* or *250ml*\n` +
      `• *1 cup* or *1 glass*\n` +
      `• *16 oz*\n` +
      `• *0.5 l*`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  // Parse and log the amount
  const amount = parseWaterAmount(input);
  
  if (!amount || amount <= 0 || amount > 5000) {
    return ctx.reply(
      '⚠️ Please enter a valid water amount.\n\n' +
      'Examples:\n' +
      '• `/water 250` or `/water 250ml`\n' +
      '• `/water 1 cup` or `/water 1 glass`\n' +
      '• `/water 16 oz`\n' +
      '• `/water 0.5 l`'
    );
  }
  
  // Log the water
  db.water.log(userId, amount);
  
  // Get updated total
  const todayTotal = db.water.getTodayTotal(userId);
  
  await ctx.reply(
    `✅ Logged *${formatWaterAmount(amount)}* of water!\n\n` +
    `Today's total: *${formatWaterAmount(todayTotal)}*`,
    { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💧 Log More', 'log_water_inline')]
      ])
    }
  );
}

// Handle inline water logging with predefined amounts
async function logWaterAmount(ctx, amount) {
  const userId = ctx.from.id;
  
  db.water.log(userId, amount);
  const todayTotal = db.water.getTodayTotal(userId);
  
  await ctx.answerCbQuery(`Logged ${formatWaterAmount(amount)}`);
  await ctx.reply(
    `✅ Logged *${formatWaterAmount(amount)}*!\n` +
    `Today's total: *${formatWaterAmount(todayTotal)}*`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  waterHandler,
  parseWaterAmount,
  logWaterAmount
};
