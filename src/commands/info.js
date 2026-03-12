/**
 * /info Command Handler
 * Shows fasting education and general information
 */

const FASTING_EDUCATION_MESSAGE = `
📚 *Understanding Extended Fasting*

Fasting is the practice of abstaining from food for a period of time. Here are the key points:

*Benefits:*
• 🧬 *Autophagy* - Cellular cleanup and repair
• 🔥 *Fat Burning* - Body switches to using stored fat
• 📈 *HGH Increase* - Human Growth Hormone rises significantly
• 🧠 *Mental Clarity* - Many report improved focus
• 💉 *Insulin Sensitivity* - Improved blood sugar regulation

*Risks & Considerations:*
• ⚠️ *Electrolyte Imbalance* - Can cause headaches, cramps, fatigue
• ⚠️ *Low Blood Sugar* - May cause dizziness or weakness
• ⚠️ *Not for Everyone* - Pregnant women, children, and those with certain medical conditions should avoid extended fasts

*Safety Tips:*
• 💧 Stay hydrated (we'll calculate your needs)
• 🧂 Replenish electrolytes (sodium, potassium, magnesium)
• 🛑 Stop if you feel unwell
• 👨‍⚕️ Consult a doctor for fasts longer than 24-48 hours

*Fasting Phases:*
• *12 hours:* Ketosis starting
• *16-24 hours:* Autophagy initiation
• *24+ hours:* Peak autophagy / HGH increase
• *48+ hours:* Deep ketosis
• *72+ hours:* Extended fast (medical supervision recommended)
`;

async function infoHandler(ctx) {
  await ctx.reply(FASTING_EDUCATION_MESSAGE, { parse_mode: 'Markdown' });
}

module.exports = {
  infoHandler
};
