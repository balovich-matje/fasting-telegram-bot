/**
 * /help Command Handler
 * Shows all available commands
 */

async function helpHandler(ctx) {
  const helpMessage = `
🤖 *Fasting Tracker Bot - Help*\n\n
*Getting Started:*
/start - Set up your profile (age, weight, activity level, etc.)\n\n*Fasting:*
/startfast - Start a new fasting session with personalized hydration & electrolyte calculations
/stopfast - End your current fast and see a summary
/status - Check your current fast progress and phase\n\n*Tracking:*
/water [amount] - Log water intake (e.g., \`/water 250\`, \`/water 1 cup\`)
/weight [value] - Log your weight (e.g., \`/weight 75 kg\`, \`/weight 165 lbs\`)\n\n*Information:*
/help - Show this help message\n\n*During a fast, I will:*
• 💧 Send water reminders every 2 hours
• 🧂 Remind you to take electrolytes (sodium, potassium, magnesium)
• 📊 Update you on fasting phases (ketosis, autophagy, etc.)
• 📈 Track your progress\n\n*Safety Notes:*
• Stay hydrated and take electrolytes
• Stop if you feel unwell
• Consult a doctor for fasts longer than 24-48 hours
• Not recommended for users under 14
`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

module.exports = {
  helpHandler
};
