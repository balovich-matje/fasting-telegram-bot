/**
 * /status Command Handler
 * Shows current fasting status, progress, and stats
 */

const { Markup } = require('telegraf');
const db = require('../database');
const { 
  calculateElapsedTime, 
  formatElapsedTime, 
  getFastingPhase,
  calculateWaterIntake,
  formatWaterAmount
} = require('../calculations');

async function statusHandler(ctx) {
  const userId = ctx.from.id;
  
  // Get user profile
  const user = db.users.get(userId);
  if (!user) {
    return ctx.reply(
      '⚠️ You need to set up your profile first.\n\n' +
      'Please use /start to complete the onboarding process.'
    );
  }
  
  // Check for active fast
  const activeFast = db.fasts.getActive(userId);
  
  if (!activeFast) {
    // No active fast - show profile and last fast info
    const lastFast = db.fasts.getHistory(userId, 1)[0];
    
    let message = `
👤 *Your Profile*\n\n` +
      `📅 Age: ${user.age} years\n` +
      `⚧ Sex: ${user.sex}\n` +
      `⚖️ Weight: ${user.weight_kg.toFixed(1)} kg\n` +
      `📏 Height: ${user.height_cm.toFixed(0)} cm\n` +
      `🏃 Activity: ${user.activity_level}\n\n`;
    
    if (lastFast) {
      const elapsed = calculateElapsedTime(lastFast.start_time);
      const duration = formatElapsedTime(elapsed.hours + 24, elapsed.minutes); // Add 24h since it's ended
      message += `📜 Last fast: ${lastFast.end_time ? 'Completed' : 'Unknown'}\n`;
    }
    
    message += `\n🚀 Use /startfast to begin a new fast!`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  }
  
  // Active fast - show detailed status
  const elapsed = calculateElapsedTime(activeFast.start_time);
  const phase = getFastingPhase(elapsed.hours);
  const waterGoal = calculateWaterIntake(user.weight_kg, user.activity_level);
  const waterConsumed = db.water.getTotalSince(userId, activeFast.start_time);
  const waterPercent = Math.min(100, Math.round((waterConsumed / waterGoal) * 100));
  
  // Create progress bar
  const progressBarLength = 20;
  const filledBars = Math.round((waterPercent / 100) * progressBarLength);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(progressBarLength - filledBars);
  
  const statusMessage = `
⏱️ *Current Fast Status*\n\n` +
    `⏰ Elapsed: *${formatElapsedTime(elapsed.hours, elapsed.minutes)}*\n` +
    `🔄 Phase: *${phase.phase}*\n\n` +
    `📊 *Progress:*\n` +
    `${progressBar} ${waterPercent}%\n` +
    `💧 Water: *${formatWaterAmount(waterConsumed)}* / ${formatWaterAmount(waterGoal)}\n\n` +
    `🧠 *Current Phase:*\n` +
    `${phase.description}\n\n` +
    `Next milestone: ${elapsed.hours < 12 ? '12 hours (Ketosis)' : 
      elapsed.hours < 16 ? '16 hours (Autophagy)' : 
      elapsed.hours < 24 ? '24 hours (Peak Autophagy)' : 
      elapsed.hours < 48 ? '48 hours (Deep Ketosis)' : 'Keep going!'}`;
  
  await ctx.reply(
    statusMessage, 
    { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💧 Log Water', 'log_water_inline')],
        [Markup.button.callback('🏁 End Fast', 'confirm_stop_fast')]
      ])
    }
  );
}

// Handle inline log water callback
async function logWaterInline(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply(
    '💧 How much water did you drink?\n\n' +
    'Reply with an amount like: `250`, `250ml`, `1 cup`, `16 oz`',
    { parse_mode: 'Markdown' }
  );
}

// Handle inline stop fast callback
async function confirmStopFastInline(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply(
    'Are you sure you want to end your fast?',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yes, end fast', 'stop_fast_confirmed')],
      [Markup.button.callback('❌ No, continue', 'cancel_stop_fast')]
    ])
  );
}

module.exports = {
  statusHandler,
  logWaterInline,
  confirmStopFastInline
};
