/**
 * /weight Command Handler
 * Logs weight with timestamp
 */

const db = require('../database');
const { lbsToKg, kgToLbs } = require('../calculations');

/**
 * Parse weight from various input formats
 * @param {string} input - User input
 * @returns {number|null} - Weight in kg or null if invalid
 */
function parseWeight(input) {
  if (!input) return null;
  
  input = input.toLowerCase().trim();
  
  // Parse pounds
  const lbsMatch = input.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)$/);
  if (lbsMatch) {
    return lbsToKg(parseFloat(lbsMatch[1]));
  }
  
  // Parse kg
  const kgMatch = input.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kilograms?|kgs?)?$/);
  if (kgMatch) {
    return parseFloat(kgMatch[1]);
  }
  
  return null;
}

async function weightHandler(ctx) {
  const userId = ctx.from.id;
  
  // Check if user has a profile
  const user = db.users.get(userId);
  if (!user) {
    return ctx.reply(
      '⚠️ You need to set up your profile first.\n\n' +
      'Please use /start to complete the onboarding process.'
    );
  }
  
  // Get the weight from command args
  const args = ctx.message.text.split(' ').slice(1);
  const input = args.join(' ');
  
  if (!input) {
    // No weight provided - show recent history
    const latest = db.weight.getLatest(userId);
    const history = db.weight.getHistory(userId, 5);
    
    let message = `⚖️ *Weight Tracking*\n\n`;
    
    if (latest) {
      const latestDate = new Date(latest.logged_at).toLocaleDateString();
      message += `Current weight: *${latest.weight_kg.toFixed(1)} kg* (${(latest.weight_kg * 2.20462).toFixed(1)} lbs)\n`;
      message += `Last updated: ${latestDate}\n\n`;
    } else {
      message += `No weight recorded yet.\n\n`;
    }
    
    if (history.length > 0) {
      message += `Recent history:\n`;
      history.forEach(log => {
        const date = new Date(log.logged_at).toLocaleDateString();
        message += `• ${date}: ${log.weight_kg.toFixed(1)} kg\n`;
      });
      message += `\n`;
    }
    
    message += `Log your weight:\n` +
      `• \`/weight 75\` or \`/weight 75 kg\`\n` +
      `• \`/weight 165 lbs\``;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  // Parse and log the weight
  const weightKg = parseWeight(input);
  
  if (!weightKg || weightKg < 20 || weightKg > 300) {
    return ctx.reply(
      '⚠️ Please enter a valid weight.\n\n' +
      'Examples:\n' +
      '• `/weight 75` or `/weight 75 kg`\n' +
      '• `/weight 165 lbs`'
    );
  }
  
  // Log the weight
  db.weight.log(userId, weightKg);
  
  // Calculate change from previous
  const latest = db.weight.getLatest(userId);
  const history = db.weight.getHistory(userId, 2);
  let changeText = '';
  
  if (history.length > 1) {
    const previous = history[1];
    const change = weightKg - previous.weight_kg;
    const changeLbs = change * 2.20462;
    
    if (Math.abs(change) >= 0.1) {
      const arrow = change < 0 ? '⬇️' : '⬆️';
      const sign = change > 0 ? '+' : '';
      changeText = `\n${arrow} Change from last: *${sign}${change.toFixed(1)} kg* (${sign}${changeLbs.toFixed(1)} lbs)`;
    }
  }
  
  await ctx.reply(
    `✅ Weight logged: *${weightKg.toFixed(1)} kg* (${(weightKg * 2.20462).toFixed(1)} lbs)` +
    changeText,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  weightHandler,
  parseWeight
};
