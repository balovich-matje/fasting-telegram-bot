/**
 * /stopfast Command Handler
 * Ends the current fasting session with summary
 */

const db = require('../database');
const { calculateElapsedTime, formatElapsedTime } = require('../calculations');

async function stopFastHandler(ctx) {
  const userId = ctx.from.id;
  
  // Check if there's an active fast
  const activeFast = db.fasts.getActive(userId);
  if (!activeFast) {
    return ctx.reply(
      '⚠️ You don\'t have an active fast.\n\n' +
      'Use /startfast to begin a new fasting session.'
    );
  }
  
  // Calculate elapsed time
  const elapsed = calculateElapsedTime(activeFast.start_time);
  const formattedTime = formatElapsedTime(elapsed.hours, elapsed.minutes);
  
  // Get water consumed during this fast
  const waterConsumed = db.water.getTotalSince(userId, activeFast.start_time);
  
  // End the fast
  db.fasts.stop(userId);
  
  // Send summary
  const summary = `
🏁 *Fast Completed!*\n\n` +
    `⏱️ Duration: *${formattedTime}*\n` +
    `💧 Water consumed: *${waterConsumed} ml*\n\n` +
    `Great job! Your body has gone through several beneficial phases.\n\n` +
    `When breaking your fast:\n` +
    `• Start with small, easily digestible foods\n` +
    `• Avoid heavy or greasy meals immediately\n` +
    `• Consider bone broth or light soup\n\n` +
    `Use /startfast when you\'re ready for your next fast!`;
  
  await ctx.reply(summary, { parse_mode: 'Markdown' });
}

module.exports = {
  stopFastHandler
};
