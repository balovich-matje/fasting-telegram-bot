/**
 * Fasting Tracker Bot - Main Entry Point
 * 
 * A personalized fasting tracker Telegram Bot that:
 * - Manages user onboarding and profiles
 * - Calculates hydration and electrolyte needs
 * - Sends reminders during fasts
 * - Tracks fasting phases and milestones
 */

require('dotenv').config();

const { Telegraf, Scenes, session, Markup } = require('telegraf');
const { Scheduler } = require('./utils/scheduler');
const db = require('./database');

// Import scenes
const { ONBOARDING_SCENE, onboardingWizard } = require('./scenes/onboarding');

// Import command handlers
const { 
  startFastHandler, 
  handleTimeInput,
  startFastNow, 
  startFastYesterdayEvening,
  startFastYesterdayAfternoon,
  cancelStartFast 
} = require('./commands/startfast');
const { stopFastHandler } = require('./commands/stopfast');
const { statusHandler, logWaterInline, confirmStopFastInline } = require('./commands/status');
const { waterHandler, logWaterAmount } = require('./commands/water');
const { weightHandler } = require('./commands/weight');
const { helpHandler } = require('./commands/help');
const { infoHandler } = require('./commands/info');
const { menuHandler, menuKeyboard } = require('./commands/menu');

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = process.env.TELEGRAM_USER_ID;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

if (!ALLOWED_USER_ID) {
  console.error('❌ Error: TELEGRAM_USER_ID is required');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// User whitelist middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id?.toString();
  
  if (userId !== ALLOWED_USER_ID) {
    console.log(`Blocked unauthorized user: ${userId}`);
    if (ctx.message) {
      await ctx.reply('🚫 Sorry, this bot is private and not available to you.');
    }
    return;
  }
  
  return next();
});

// Session middleware (required for scenes)
bot.use(session());

// Set up stage with scenes
const stage = new Scenes.Stage([onboardingWizard]);
bot.use(stage.middleware());

// Initialize scheduler
const scheduler = new Scheduler(bot);

// ============= COMMANDS =============

// /start - Begin onboarding or show menu
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const hasProfile = db.users.exists(userId);
  
  if (hasProfile) {
    await ctx.reply(
      '👋 Welcome back!\n\n' +
      'What would you like to do?\n\n' +
      '🚀 /startfast - Start a new fast\n' +
      '📊 /status - Check your status\n' +
      '⚖️ /weight - Log weight\n' +
      '💧 /water - Log water\n' +
      '❓ /help - Show all commands',
      Markup.removeKeyboard()
    );
  } else {
    // Start onboarding
    await ctx.scene.enter(ONBOARDING_SCENE);
  }
});

// /menu - Show main menu with buttons
bot.command('menu', menuHandler);

// /info - Show fasting education
bot.command('info', infoHandler);

// /startfast - Start a new fasting session
bot.command('startfast', startFastHandler);

// /stopfast - End current fasting session
bot.command('stopfast', stopFastHandler);

// /status - Check fasting status
bot.command('status', statusHandler);

// /water - Log water intake
bot.command('water', waterHandler);

// /weight - Log weight
bot.command('weight', weightHandler);

// /help - Show help
bot.command('help', helpHandler);

// ============= CALLBACK QUERY HANDLERS =============

// Start fast time options
bot.action('start_fast_now', startFastNow);
bot.action('start_fast_yesterday_evening', startFastYesterdayEvening);
bot.action('start_fast_yesterday_afternoon', startFastYesterdayAfternoon);
bot.action('cancel_start_fast', cancelStartFast);

// Stop fast confirmation
bot.action('confirm_stop_fast', confirmStopFastInline);
bot.action('stop_fast_confirmed', async (ctx) => {
  await ctx.answerCbQuery('Ending fast...');
  await ctx.editMessageText('🏁 Ending your fast...');
  await stopFastHandler(ctx);
});
bot.action('cancel_stop_fast', async (ctx) => {
  await ctx.answerCbQuery('Continuing fast');
  await ctx.editMessageText('✅ Continuing your fast! Stay strong! 💪');
});

// Water logging from inline buttons
bot.action('log_water_inline', logWaterInline);
bot.action('water_250', async (ctx) => {
  await ctx.answerCbQuery('Logged 250ml');
  await logWaterAmount(ctx, 250);
});
bot.action('water_500', async (ctx) => {
  await ctx.answerCbQuery('Logged 500ml');
  await logWaterAmount(ctx, 500);
});
bot.action('water_cup', async (ctx) => {
  await ctx.answerCbQuery('Logged 1 cup (250ml)');
  await logWaterAmount(ctx, 250);
});
bot.action('water_glass', async (ctx) => {
  await ctx.answerCbQuery('Logged 1 glass (250ml)');
  await logWaterAmount(ctx, 250);
});

// ============= TEXT MESSAGE HANDLERS =============

// Handle water amount replies (when user just types a number without /water)
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  
  // Check if user is in start fast flow waiting for time
  const { isWaitingForTime } = require('./commands/startfast');
  if (isWaitingForTime(userId)) {
    return handleTimeInput(ctx);
  }
  
  const { parseWaterAmount } = require('./commands/water');
  
  // Check if this looks like a water amount
  const amount = parseWaterAmount(text);
  
  if (amount && amount > 0 && amount <= 5000) {
    // Check if user has an active fast or recent water command
    const lastReminder = db.reminders.getLastReminder(userId, 'water');
    
    if (lastReminder) {
      const lastReminderTime = new Date(lastReminder.sent_at);
      const now = new Date();
      const minutesSinceReminder = (now - lastReminderTime) / (1000 * 60);
      
      // If last water reminder was within 30 minutes, accept this as water logging
      if (minutesSinceReminder < 30) {
        db.water.log(userId, amount);
        const todayTotal = db.water.getTodayTotal(userId);
        
        return ctx.reply(
          `✅ Logged *${amount}ml*!\n` +
          `Today's total: *${todayTotal}ml*`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  }
  
  return next();
});

// Handle menu button text
bot.hears('🚀 Start Fast', async (ctx) => startFastHandler(ctx));
bot.hears('📊 Status', async (ctx) => statusHandler(ctx));
bot.hears('💧 Log Water', async (ctx) => waterHandler(ctx));
bot.hears('⚖️ Log Weight', async (ctx) => weightHandler(ctx));
bot.hears('ℹ️ Fasting Info', async (ctx) => infoHandler(ctx));
bot.hears('❓ Help', async (ctx) => helpHandler(ctx));

// ============= ERROR HANDLING =============

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again or use /help for assistance.')
    .catch(() => {});
});

// ============= STARTUP =============

async function startBot() {
  try {
    // Start the bot
    await bot.launch();
    console.log('🤖 Bot started successfully!');
    console.log(`👤 Allowed user ID: ${ALLOWED_USER_ID}`);
    
    // Start the scheduler
    scheduler.start();
    
    // Send startup message to allowed user
    try {
      await bot.telegram.sendMessage(
        ALLOWED_USER_ID,
        '🤖 *Fasting Tracker Bot is online!*\n\n' +
        'Ready to start your fasting journey?\n\n' +
        'Use the menu below or type /menu anytime.',
        { 
          parse_mode: 'Markdown',
          ...menuKeyboard
        }
      );
    } catch (err) {
      console.log('Could not send startup message to user:', err.message);
    }
  } catch (err) {
    console.error('Failed to start bot:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  scheduler.stop();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  scheduler.stop();
  bot.stop('SIGTERM');
});

// Start the bot
startBot();
