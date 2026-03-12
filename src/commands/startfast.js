/**
 * /startfast Command Handler
 * Initiates a new fasting session with custom start time support
 */

const { Markup } = require('telegraf');
const db = require('../database');
const { 
  calculateWaterIntake, 
  calculateElectrolytes, 
  calculateElectrolyteDoses,
  calculateWaterReminders,
  verifyAge,
  formatWaterAmount
} = require('../calculations');

// Store temporary state for users starting a fast
const startFastState = new Map();

/**
 * Parse custom date/time input
 * Supports formats:
 * - "now" - current time
 * - "MM:DD HH:MM" - specific date and time
 * - "DD.MM HH:MM" - alternative format
 * - "HH:MM" - today at specific time (if not in future, then yesterday)
 * @param {string} input - User input
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseCustomTime(input) {
  input = input.toLowerCase().trim();
  
  if (input === 'now') {
    return new Date();
  }
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try MM:DD HH:MM format (e.g., "12:25 18:30" = Dec 25, 18:30)
  const mdhmMatch = input.match(/^(\d{1,2})[:\/](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (mdhmMatch) {
    const month = parseInt(mdhmMatch[1]) - 1; // 0-based
    const day = parseInt(mdhmMatch[2]);
    const hour = parseInt(mdhmMatch[3]);
    const minute = parseInt(mdhmMatch[4]);
    
    let date = new Date(currentYear, month, day, hour, minute);
    
    // If date is in the future, assume it's last year
    if (date > now) {
      date = new Date(currentYear - 1, month, day, hour, minute);
    }
    
    return date;
  }
  
  // Try DD.MM HH:MM format (e.g., "25.12 18:30")
  const dmhmMatch = input.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (dmhmMatch) {
    const day = parseInt(dmhmMatch[1]);
    const month = parseInt(dmhmMatch[2]) - 1;
    const hour = parseInt(dmhmMatch[3]);
    const minute = parseInt(dmhmMatch[4]);
    
    let date = new Date(currentYear, month, day, hour, minute);
    
    if (date > now) {
      date = new Date(currentYear - 1, month, day, hour, minute);
    }
    
    return date;
  }
  
  // Try HH:MM format (today or yesterday)
  const hmMatch = input.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) {
    const hour = parseInt(hmMatch[1]);
    const minute = parseInt(hmMatch[2]);
    
    let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
    
    // If time is in the future, assume yesterday
    if (date > now) {
      date.setDate(date.getDate() - 1);
    }
    
    return date;
  }
  
  return null;
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function startFastHandler(ctx) {
  const userId = ctx.from.id;
  
  // Check if user has a profile
  const user = db.users.get(userId);
  if (!user) {
    return ctx.reply(
      '⚠️ You need to set up your profile first.\n\n' +
      'Please use /start to complete the onboarding process.'
    );
  }
  
  // Check age restrictions before starting
  const ageCheck = verifyAge(user.age);
  if (ageCheck.status === 'stop') {
    return ctx.reply(`🚫 ${ageCheck.message}`);
  }
  
  // Check if there's already an active fast
  const activeFast = db.fasts.getActive(userId);
  if (activeFast) {
    return ctx.reply(
      '⚠️ You already have an active fast!\n\n' +
      'Use /status to check your progress or /stopfast to end it.'
    );
  }
  
  // Show personalized requirements first
  const waterGoal = calculateWaterIntake(user.weight_kg, user.activity_level);
  const electrolytes = calculateElectrolytes(user.activity_level);
  const doses = calculateElectrolyteDoses(electrolytes, 4);
  const waterReminders = calculateWaterReminders(waterGoal);
  
  const requirementsMessage = `
📊 *Your Personalized Requirements*

Based on your profile (${user.weight_kg.toFixed(1)}kg, ${user.activity_level} activity):

💧 *Daily Water Goal:* ${formatWaterAmount(waterGoal)}
   (~${formatWaterAmount(waterReminders.amountPerReminder)} every ${waterReminders.intervalMinutes / 60} hours)

🧂 *Daily Electrolytes:*
   • Sodium: ${electrolytes.sodium}mg
   • Potassium: ${electrolytes.potassium}mg
   • Magnesium: ${electrolytes.magnesium}mg

💊 *Suggested Dosing (4x daily):*
   • Sodium: ${doses.sodium}mg per dose
   • Potassium: ${doses.potassium}mg per dose
   • Magnesium: ${doses.magnesium}mg per dose

⚠️ *Mix electrolytes with water and spread throughout the day to avoid stomach upset.*
`;
  
  // Show warning for teenagers
  if (ageCheck.status === 'warning') {
    await ctx.reply(`⚠️ *Age Warning:* ${ageCheck.message}`, { parse_mode: 'Markdown' });
  }
  
  await ctx.reply(requirementsMessage, { parse_mode: 'Markdown' });
  
  // Ask for start time
  const timePrompt = `
🕐 *When did you start your fast?*

You can enter:
• \`now\` - Start from this moment
• \`HH:MM\` - Today at specific time (e.g., \`18:30\`)
• \`MM:DD HH:MM\` - Specific date and time (e.g., \`12:25 18:30\` for Dec 25, 18:30)

Or tap a button below:`;

  startFastState.set(userId, { step: 'waiting_for_time' });
  
  await ctx.reply(
    timePrompt,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('▶️ Start Now', 'start_fast_now')],
        [Markup.button.callback('⏪ Started Yesterday Evening', 'start_fast_yesterday_evening')],
        [Markup.button.callback('⏮️ Started Yesterday Afternoon', 'start_fast_yesterday_afternoon')],
        [Markup.button.callback('❌ Cancel', 'cancel_start_fast')]
      ])
    }
  );
}

// Handle text input for custom time
async function handleTimeInput(ctx) {
  const userId = ctx.from.id;
  const state = startFastState.get(userId);
  
  if (!state || state.step !== 'waiting_for_time') {
    return; // Not in start fast flow
  }
  
  const input = ctx.message.text;
  const customDate = parseCustomTime(input);
  
  if (!customDate) {
    return ctx.reply(
      '⚠️ Invalid format. Please use one of these formats:\n\n' +
      '• `now`\n' +
      '• `HH:MM` (e.g., `18:30`)\n' +
      '• `MM:DD HH:MM` (e.g., `12:25 18:30`)\n\n' +
      'Or tap a button above.',
      { parse_mode: 'Markdown' }
    );
  }
  
  // Check if date is in the future
  if (customDate > new Date()) {
    return ctx.reply(
      '⚠️ The date/time cannot be in the future. Please enter a valid past time.',
      { parse_mode: 'Markdown' }
    );
  }
  
  // Confirm and start
  await confirmAndStartFast(ctx, userId, customDate);
}

// Start fast from now
async function startFastNow(ctx) {
  await ctx.answerCbQuery('Starting fast...');
  await confirmAndStartFast(ctx, ctx.from.id, new Date());
}

// Start fast from yesterday evening (20:00)
async function startFastYesterdayEvening(ctx) {
  await ctx.answerCbQuery('Setting start time to yesterday evening...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(20, 0, 0, 0);
  await confirmAndStartFast(ctx, ctx.from.id, yesterday);
}

// Start fast from yesterday afternoon (14:00)
async function startFastYesterdayAfternoon(ctx) {
  await ctx.answerCbQuery('Setting start time to yesterday afternoon...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(14, 0, 0, 0);
  await confirmAndStartFast(ctx, ctx.from.id, yesterday);
}

// Confirm and start the fast
async function confirmAndStartFast(ctx, userId, startDate) {
  // Double-check age
  const user = db.users.get(userId);
  const ageCheck = verifyAge(user.age);
  if (ageCheck.status === 'stop') {
    startFastState.delete(userId);
    return ctx.reply(`🚫 ${ageCheck.message}`);
  }
  
  // Start the fast with custom time using the proper API
  const result = db.fasts.start(userId, null, startDate);
  
  // Clear state
  startFastState.delete(userId);
  
  const elapsed = Math.floor((new Date() - startDate) / (1000 * 60 * 60));
  const elapsedText = elapsed > 0 ? ` (${elapsed} hours ago)` : '';
  
  await ctx.reply(
    '✅ *Your fast has started!*\n\n' +
    `🕐 Start time: *${formatDate(startDate)}*${elapsedText}\n\n` +
    'I\'ll send you reminders for water and electrolytes.\n' +
    'You\'ll also receive updates as you hit fasting milestones.\n\n' +
    'Commands:\n' +
    '• /status - Check progress\n' +
    '• /water - Log water intake\n' +
    '• /stopfast - End your fast',
    { parse_mode: 'Markdown' }
  );
}

// Handle cancel callback
async function cancelStartFast(ctx) {
  const userId = ctx.from.id;
  startFastState.delete(userId);
  await ctx.answerCbQuery('Cancelled');
  await ctx.editMessageText('❌ Fast initiation cancelled. Use /startfast when you\'re ready.');
}

// Check if user is in start fast flow
function isWaitingForTime(userId) {
  const state = startFastState.get(userId);
  return state && state.step === 'waiting_for_time';
}

module.exports = {
  startFastHandler,
  handleTimeInput,
  startFastNow,
  startFastYesterdayEvening,
  startFastYesterdayAfternoon,
  cancelStartFast,
  isWaitingForTime
};
