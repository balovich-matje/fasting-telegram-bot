/**
 * Scheduler Module
 * Handles water reminders, electrolyte reminders, and fasting phase notifications
 */

const cron = require('node-cron');
const { Markup } = require('telegraf');
const db = require('../database');
const { 
  calculateElapsedTime, 
  checkMilestone, 
  getFastingPhase,
  calculateWaterIntake,
  calculateWaterReminders,
  formatWaterAmount,
  formatElapsedTime
} = require('../calculations');

class Scheduler {
  constructor(bot) {
    this.bot = bot;
    this.tasks = [];
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    // Water reminders - every 30 minutes
    this.tasks.push(cron.schedule('*/30 * * * *', () => {
      this.sendWaterReminders();
    }));

    // Electrolyte reminders - every 6 hours (4x daily)
    this.tasks.push(cron.schedule('0 */6 * * *', () => {
      this.sendElectrolyteReminders();
    }));

    // Phase milestone checks - every 15 minutes
    this.tasks.push(cron.schedule('*/15 * * * *', () => {
      this.checkPhaseMilestones();
    }));

    console.log('📅 Scheduler started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('📅 Scheduler stopped');
  }

  /**
   * Send water reminders to users with active fasts
   */
  async sendWaterReminders() {
    try {
      // Get all active fasts
      const activeFasts = db.db.prepare(`
        SELECT f.*, u.weight_kg, u.activity_level 
        FROM fasts f
        JOIN users u ON f.user_id = u.user_id
        WHERE f.is_active = 1
      `).all();

      for (const fast of activeFasts) {
        const userId = fast.user_id;
        
        // Calculate how much water should have been consumed by now
        const waterGoal = calculateWaterIntake(fast.weight_kg, fast.activity_level);
        const elapsed = calculateElapsedTime(fast.start_time);
        const waterReminders = calculateWaterReminders(waterGoal);
        
        // Calculate expected water intake so far
        const elapsedMinutes = elapsed.totalMinutes;
        const expectedWater = Math.round((elapsedMinutes / (16 * 60)) * waterGoal);
        
        // Get actual water consumed since fast start
        const actualWater = db.water.getTotalSince(userId, fast.start_time);
        
        // Only remind if behind schedule
        if (actualWater < expectedWater * 0.8) {
          const remaining = waterGoal - actualWater;
          const behindAmount = expectedWater - actualWater;
          
          const message = `
💧 *Water Reminder*\n\n` +
            `⏱️ Fast duration: *${formatElapsedTime(elapsed.hours, elapsed.minutes)}*\n` +
            `💧 Today's goal: *${formatWaterAmount(waterGoal)}*\n` +
            `✅ Consumed: *${formatWaterAmount(actualWater)}*\n` +
            `⏳ Remaining: *${formatWaterAmount(Math.max(0, remaining))}*\n\n` +
            (behindAmount > 0 ? `⚠️ You're *${formatWaterAmount(behindAmount)}* behind schedule.\n\n` : '') +
            `Stay hydrated! Drink a glass of water now. 💪`;

          try {
            await this.bot.telegram.sendMessage(
              userId,
              message,
              {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                  [
                    Markup.button.callback('✅ 250ml', `water_250`),
                    Markup.button.callback('✅ 500ml', `water_500`)
                  ],
                  [
                    Markup.button.callback('✅ 1 cup', `water_cup`),
                    Markup.button.callback('✅ 1 glass', `water_glass`)
                  ]
                ])
              }
            );
            
            // Log the reminder
            db.reminders.log(userId, 'water', message);
          } catch (err) {
            console.error(`Failed to send water reminder to ${userId}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Error sending water reminders:', err);
    }
  }

  /**
   * Send electrolyte reminders to users with active fasts
   */
  async sendElectrolyteReminders() {
    try {
      const activeFasts = db.db.prepare(`
        SELECT f.*, u.weight_kg, u.activity_level 
        FROM fasts f
        JOIN users u ON f.user_id = u.user_id
        WHERE f.is_active = 1
      `).all();

      for (const fast of activeFasts) {
        const userId = fast.user_id;
        
        // Only send after 12 hours of fasting (when electrolytes become important)
        const elapsed = calculateElapsedTime(fast.start_time);
        if (elapsed.hours < 12) continue;

        const { sodium, potassium, magnesium } = require('../calculations').calculateElectrolytes(fast.activity_level);
        const doseCount = Math.floor(elapsed.hours / 6); // Which dose number this is
        
        const message = `
🧂 *Electrolyte Reminder*\n\n` +
          `It's time for your electrolytes!\n\n` +
          `💊 *Suggested dose:*\n` +
          `• Sodium: ~${Math.round(sodium / 4)}mg\n` +
          `• Potassium: ~${Math.round(potassium / 4)}mg\n` +
          `• Magnesium: ~${Math.round(magnesium / 4)}mg\n\n` +
          `💡 *Tips:*\n` +
          `• Mix with water\n` +
          `• Take with your next glass of water\n` +
          `• Spread throughout the day for best absorption\n\n` +
          `⚠️ *Listen to your body* - if you feel dizzy, lightheaded, or have muscle cramps, you may need more electrolytes.`;

        try {
          await this.bot.telegram.sendMessage(
            userId,
            message,
            { parse_mode: 'Markdown' }
          );
          
          db.reminders.log(userId, 'electrolyte', message);
        } catch (err) {
          console.error(`Failed to send electrolyte reminder to ${userId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error sending electrolyte reminders:', err);
    }
  }

  /**
   * Check for and send phase milestone notifications
   */
  async checkPhaseMilestones() {
    try {
      const activeFasts = db.db.prepare(`
        SELECT f.*, u.weight_kg, u.activity_level 
        FROM fasts f
        JOIN users u ON f.user_id = u.user_id
        WHERE f.is_active = 1
      `).all();

      for (const fast of activeFasts) {
        const userId = fast.user_id;
        const fastId = fast.id;
        
        const elapsed = calculateElapsedTime(fast.start_time);
        const milestone = checkMilestone(elapsed.hours);
        
        if (!milestone) continue;
        
        // Check if we already notified for this milestone
        if (db.phaseNotifications.hasBeenNotified(userId, fastId, milestone)) {
          continue;
        }

        const phase = getFastingPhase(elapsed.hours);
        
        let milestoneMessage = '';
        let emoji = '🎉';
        
        switch (milestone) {
          case '12h':
            emoji = '🔥';
            milestoneMessage = `
${emoji} *Milestone Reached: 12 Hours*\n\n` +
              `Your body is entering *ketosis*!\n\n` +
              `🧬 Glycogen stores are depleting\n` +
              `🔥 Fat burning is beginning\n` +
              `⚡ Energy levels may shift\n\n` +
              `${phase.description}`;
            break;
            
          case '16h':
            emoji = '✨';
            milestoneMessage = `
${emoji} *Milestone Reached: 16 Hours*\n\n` +
              `*Autophagy is starting!*\n\n` +
              `🧹 Your cells are beginning their cleanup process\n` +
              `♻️ Damaged proteins and components are being recycled\n` +
              `🛡️ This process supports cellular health and longevity\n\n` +
              `${phase.description}`;
            break;
            
          case '24h':
            emoji = '🌟';
            milestoneMessage = `
${emoji} *Milestone Reached: 24 Hours*\n\n` +
              `You've completed a full day of fasting!\n\n` +
              `📈 *Human Growth Hormone (HGH)* is significantly elevated\n` +
              `🧬 *Autophagy* is in full swing\n` +
              `🔥 *Fat burning* is optimized\n` +
              `🧠 Many report improved mental clarity at this stage\n\n` +
              `${phase.description}\n\n` +
              `⚠️ For fasts beyond 24-48 hours, consider medical supervision.`;
            break;
            
          case '48h':
            emoji = '🏆';
            milestoneMessage = `
${emoji} *Milestone Reached: 48 Hours*\n\n` +
              `Incredible! You've reached a deep fasted state.\n\n` +
              `🔥 *Deep Ketosis* - Your body is efficiently burning fat\n` +
              `🧠 *Mental Clarity* - Many experience peak focus\n` +
              `🧬 *Autophagy* - Continued cellular renewal\n\n` +
              `${phase.description}\n\n` +
              `⚠️ *Important:* If continuing beyond 48 hours, ensure you have:\n` +
              `• Adequate electrolyte intake\n` +
              `• Medical supervision or consultation\n` +
              `• A clear plan for breaking the fast`;
            break;
            
          case '72h':
            emoji = '👑';
            milestoneMessage = `
${emoji} *Milestone Reached: 72 Hours*\n\n` +
              `Outstanding achievement! You've completed a 3-day extended fast.\n\n` +
              `Your body has undergone significant renewal processes.\n\n` +
              `${phase.description}\n\n` +
              `⚠️ *Critical:* Fast beyond 72 hours should only be done with medical supervision.\n\n` +
              `Consider ending your fast soon and refeeding properly.\n` +
              `Use /stopfast when you're ready.`;
            break;
        }

        try {
          await this.bot.telegram.sendMessage(
            userId,
            milestoneMessage,
            { parse_mode: 'Markdown' }
          );
          
          // Mark as notified
          db.phaseNotifications.markNotified(userId, fastId, milestone);
        } catch (err) {
          console.error(`Failed to send milestone notification to ${userId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error checking phase milestones:', err);
    }
  }
}

module.exports = { Scheduler };
