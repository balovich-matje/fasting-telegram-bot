/**
 * Onboarding Wizard
 * Step-by-step conversation to collect user metrics
 */

const { Scenes, Markup } = require('telegraf');
const { users } = require('../database');
const { menuKeyboard } = require('../commands/menu');
const { 
  ACTIVITY_LEVELS, 
  lbsToKg, 
  inchesToCm, 
  verifyAge 
} = require('../calculations');

// Scene names
const ONBOARDING_SCENE = 'ONBOARDING_SCENE';

// Wizard steps
const STEPS = {
  AGE: 0,
  SEX: 1,
  WEIGHT: 2,
  HEIGHT: 3,
  ACTIVITY: 4,
  BODY_FAT: 5,
  CONFIRM: 6
};

// Create the onboarding wizard scene
const onboardingWizard = new Scenes.WizardScene(
  ONBOARDING_SCENE,
  // Step 0: Ask for age
  async (ctx) => {
    await ctx.reply(
      '🎉 Welcome to your Personal Fasting Tracker!\n\n' +
      'Let\'s set up your profile first. This will help me calculate your hydration and electrolyte needs.\n\n' +
      'Step 1/6: What is your *age*?',
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },
  
  // Step 1: Ask for sex
  async (ctx) => {
    const age = parseInt(ctx.message?.text);
    
    if (isNaN(age) || age < 1 || age > 120) {
      await ctx.reply('⚠️ Please enter a valid age between 1 and 120.');
      return;
    }
    
    ctx.wizard.state.age = age;
    
    // Check age restrictions
    const ageCheck = verifyAge(age);
    if (ageCheck.status === 'stop') {
      await ctx.reply(`🚫 ${ageCheck.message}`);
      return ctx.scene.leave();
    }
    
    if (ageCheck.status === 'warning') {
      await ctx.reply(`⚠️ ${ageCheck.message}`);
    }
    
    await ctx.reply(
      'Step 2/6: What is your *sex*?',
      Markup.keyboard([['Male', 'Female'], ['Other']])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },
  
  // Step 2: Ask for weight
  async (ctx) => {
    const sex = ctx.message?.text;
    const validSexes = ['Male', 'Female', 'Other'];
    
    if (!validSexes.includes(sex)) {
      await ctx.reply('⚠️ Please select a valid option from the keyboard.');
      return;
    }
    
    ctx.wizard.state.sex = sex;
    
    await ctx.reply(
      'Step 3/6: What is your current *weight*?\n\n' +
      'You can enter:\n' +
      '• Kilograms: `75` or `75 kg`\n' +
      '• Pounds: `165 lbs` or `165 lb`',
      { 
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard()
      }
    );
    return ctx.wizard.next();
  },
  
  // Step 3: Ask for height
  async (ctx) => {
    const weightText = ctx.message?.text?.toLowerCase().trim();
    
    // Parse weight
    let weightKg;
    const lbsMatch = weightText.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)$/);
    const kgMatch = weightText.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)?$/);
    
    if (lbsMatch) {
      weightKg = lbsToKg(parseFloat(lbsMatch[1]));
    } else if (kgMatch) {
      weightKg = parseFloat(kgMatch[1]);
    } else {
      await ctx.reply(
        '⚠️ Please enter a valid weight.\n\n' +
        'Examples: `75`, `75 kg`, `165 lbs`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    if (weightKg < 20 || weightKg > 300) {
      await ctx.reply('⚠️ Please enter a realistic weight (20-300 kg / 45-660 lbs).');
      return;
    }
    
    ctx.wizard.state.weightKg = weightKg;
    
    await ctx.reply(
      'Step 4/6: What is your *height*?\n\n' +
      'You can enter:\n' +
      '• Centimeters: `175` or `175 cm`\n' +
      "• Feet/Inches: `5'9` or `5 ft 9 in`",
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },
  
  // Step 4: Ask for activity level
  async (ctx) => {
    const heightText = ctx.message?.text?.toLowerCase().trim();
    
    // Parse height
    let heightCm;
    const cmMatch = heightText.match(/^(\d+(?:\.\d+)?)\s*(?:cm)?$/);
    const ftInMatch = heightText.match(/^(\d+)\s*(?:ft|')\s*(\d+)?\s*(?:in|")?$/);
    const ftOnlyMatch = heightText.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)$/);
    
    if (cmMatch) {
      heightCm = parseFloat(cmMatch[1]);
    } else if (ftInMatch) {
      const feet = parseInt(ftInMatch[1]);
      const inches = parseInt(ftInMatch[2] || 0);
      heightCm = (feet * 12 + inches) * 2.54;
    } else if (ftOnlyMatch) {
      heightCm = parseFloat(ftOnlyMatch[1]) * 12 * 2.54;
    } else {
      await ctx.reply(
        '⚠️ Please enter a valid height.\n\n' +
        "Examples: `175`, `175 cm`, `5'9`, `5 ft 9 in`",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    if (heightCm < 100 || heightCm > 250) {
      await ctx.reply("⚠️ Please enter a realistic height (100-250 cm / 3'3\" - 8'2\").");
      return;
    }
    
    ctx.wizard.state.heightCm = heightCm;
    
    await ctx.reply(
      'Step 5/6: What is your *daily physical activity level*?\n\n' +
      '🛋️ *Sedentary* - Little to no exercise\n' +
      '🚶 *Light* - Light exercise 1-3 days/week\n' +
      '🏃 *Moderate* - Moderate exercise 3-5 days/week\n' +
      '🏋️ *Active* - Hard exercise 6-7 days/week\n' +
      '🔥 *Very Active* - Very hard exercise, physical job, or training twice a day',
      Markup.keyboard([
        [ACTIVITY_LEVELS.SEDENTARY],
        [ACTIVITY_LEVELS.LIGHT],
        [ACTIVITY_LEVELS.MODERATE],
        [ACTIVITY_LEVELS.ACTIVE],
        [ACTIVITY_LEVELS.VERY_ACTIVE]
      ])
        .oneTime()
        .resize()
    );
    return ctx.wizard.next();
  },
  
  // Step 5: Ask for body fat % (optional)
  async (ctx) => {
    const activity = ctx.message?.text;
    const validActivities = Object.values(ACTIVITY_LEVELS);
    
    if (!validActivities.includes(activity)) {
      await ctx.reply('⚠️ Please select a valid activity level from the keyboard.');
      return;
    }
    
    ctx.wizard.state.activityLevel = activity;
    
    await ctx.reply(
      'Step 6/6 (Optional): What is your estimated *body fat percentage*?\n\n' +
      "Enter a number (e.g., `20`) or type `skip` if you don't know.",
      { 
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard()
      }
    );
    return ctx.wizard.next();
  },
  
  // Step 6: Confirm and save
  async (ctx) => {
    const bodyFatText = ctx.message?.text?.toLowerCase().trim();
    
    let bodyFatPercent = null;
    if (bodyFatText !== 'skip') {
      const bodyFat = parseFloat(bodyFatText);
      if (!isNaN(bodyFat) && bodyFat > 0 && bodyFat < 100) {
        bodyFatPercent = bodyFat;
      }
    }
    
    ctx.wizard.state.bodyFatPercent = bodyFatPercent;
    
    const state = ctx.wizard.state;
    const ageCheck = verifyAge(state.age);
    
    // Show summary
    const summary = 
      '📝 *Profile Summary*\n\n' +
      `📅 Age: ${state.age} years\n` +
      `⚧ Sex: ${state.sex}\n` +
      `⚖️ Weight: ${state.weightKg.toFixed(1)} kg (${(state.weightKg * 2.20462).toFixed(1)} lbs)\n` +
      `📏 Height: ${state.heightCm.toFixed(0)} cm (${(state.heightCm / 2.54 / 12).toFixed(1)} ft)\n` +
      `🏃 Activity: ${state.activityLevel}\n` +
      `📊 Body Fat: ${state.bodyFatPercent ? state.bodyFatPercent + '%' : 'Not specified'}\n` +
      (ageCheck.status === 'warning' ? '\n⚠️ *Warning:* ' + ageCheck.message : '');
    
    await ctx.reply(
      summary,
      { 
        parse_mode: 'Markdown',
        ...Markup.keyboard([['✅ Save Profile', '❌ Start Over']])
          .oneTime()
          .resize()
      }
    );
    
    return ctx.wizard.next();
  },
  
  // Final step: Save or restart
  async (ctx) => {
    const choice = ctx.message?.text;
    
    if (choice === '❌ Start Over') {
      await ctx.reply(
        "Let's start over. What is your *age*?",
        { 
          parse_mode: 'Markdown',
          ...Markup.removeKeyboard()
        }
      );
      // Reset state and go back to step 1
      ctx.wizard.state = {};
      ctx.wizard.selectStep(STEPS.AGE);
      return;
    }
    
    if (choice === '✅ Save Profile') {
      const state = ctx.wizard.state;
      const userId = ctx.from.id;
      
      // Save to database
      users.create({
        user_id: userId,
        age: state.age,
        sex: state.sex,
        weight_kg: state.weightKg,
        height_cm: state.heightCm,
        activity_level: state.activityLevel,
        body_fat_percent: state.bodyFatPercent
      });
      
      await ctx.reply(
        '✅ *Profile saved successfully!*\n\n' +
        'Use the menu below to get started:',
        { 
          parse_mode: 'Markdown',
          ...menuKeyboard
        }
      );
      
      return ctx.scene.leave();
    }
    
    await ctx.reply('⚠️ Please select an option from the keyboard.');
  }
);

// Handle /cancel command during onboarding
onboardingWizard.command('cancel', async (ctx) => {
  await ctx.reply(
    'Onboarding cancelled. You can start again with /start.',
    Markup.removeKeyboard()
  );
  return ctx.scene.leave();
});

module.exports = {
  ONBOARDING_SCENE,
  onboardingWizard
};
