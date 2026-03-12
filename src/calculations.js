/**
 * Calculation Helpers
 * Implements the exact formulas from AGENTS.md specification
 */

// Activity levels
const ACTIVITY_LEVELS = {
  SEDENTARY: 'Sedentary',
  LIGHT: 'Light',
  MODERATE: 'Moderate',
  ACTIVE: 'Active',
  VERY_ACTIVE: 'Very Active'
};

// Conversion constants
const LBS_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

/**
 * Convert pounds to kilograms
 * @param {number} lbs - Weight in pounds
 * @returns {number} Weight in kilograms
 */
function lbsToKg(lbs) {
  return lbs * LBS_TO_KG;
}

/**
 * Convert kilograms to pounds
 * @param {number} kg - Weight in kilograms
 * @returns {number} Weight in pounds
 */
function kgToLbs(kg) {
  return kg / LBS_TO_KG;
}

/**
 * Convert inches to centimeters
 * @param {number} inches - Height in inches
 * @returns {number} Height in centimeters
 */
function inchesToCm(inches) {
  return inches * IN_TO_CM;
}

/**
 * Convert centimeters to inches
 * @param {number} cm - Height in centimeters
 * @returns {number} Height in inches
 */
function cmToInches(cm) {
  return cm / IN_TO_CM;
}

/**
 * Age Verification Logic
 * Returns the status and appropriate message based on age
 * @param {number} age - User's age
 * @returns {Object} { status: 'stop'|'warning'|'ok', message: string }
 */
function verifyAge(age) {
  if (age < 14) {
    return {
      status: 'stop',
      message: 'For your safety, fasting trackers are not suitable for users under 14.'
    };
  }
  
  if (age >= 14 && age < 18) {
    return {
      status: 'warning',
      message: 'Please note: Extended fasting is generally not recommended for growing teenagers. Please consult a doctor.'
    };
  }
  
  return {
    status: 'ok',
    message: null
  };
}

/**
 * Calculate daily water intake during fasting
 * Formula from AGENTS.md:
 * 1. Base Water (ml) = Weight (kg) * 35
 * 2. Fasting Water (ml) = Base Water * 1.2
 * 3. Add activity modifier
 * @param {number} weightKg - Weight in kilograms
 * @param {string} activityLevel - Activity level
 * @returns {number} Total daily water in ml
 */
function calculateWaterIntake(weightKg, activityLevel) {
  // Step 1: Calculate Base Intake
  const baseWater = weightKg * 35;
  
  // Step 2: Apply Fasting Compensation (20% from food is missing)
  const fastingWater = baseWater * 1.2;
  
  // Step 3: Apply Activity Modifier
  let activityModifier = 0;
  switch (activityLevel) {
    case ACTIVITY_LEVELS.LIGHT:
      activityModifier = 500;
      break;
    case ACTIVITY_LEVELS.MODERATE:
      activityModifier = 1000;
      break;
    case ACTIVITY_LEVELS.ACTIVE:
      activityModifier = 1500;
      break;
    case ACTIVITY_LEVELS.VERY_ACTIVE:
      activityModifier = 2000;
      break;
    case ACTIVITY_LEVELS.SEDENTARY:
    default:
      activityModifier = 0;
  }
  
  // Step 4: Final Output
  return Math.round(fastingWater + activityModifier);
}

/**
 * Calculate electrolyte requirements during fasting
 * @param {string} activityLevel - Activity level
 * @returns {Object} { sodium, potassium, magnesium } in mg
 */
function calculateElectrolytes(activityLevel) {
  // Sodium (Na): Base 3000mg
  let sodium = 3000;
  if (activityLevel === ACTIVITY_LEVELS.MODERATE) {
    sodium += 500;
  } else if (activityLevel === ACTIVITY_LEVELS.ACTIVE || activityLevel === ACTIVITY_LEVELS.VERY_ACTIVE) {
    sodium += 1000;
  }
  
  // Potassium (K): Base 2000mg
  let potassium = 2000;
  if (activityLevel === ACTIVITY_LEVELS.ACTIVE || activityLevel === ACTIVITY_LEVELS.VERY_ACTIVE) {
    potassium += 500;
  }
  
  // Magnesium (Mg): Base 300mg
  let magnesium = 300;
  if (activityLevel === ACTIVITY_LEVELS.ACTIVE || activityLevel === ACTIVITY_LEVELS.VERY_ACTIVE) {
    magnesium += 100;
  }
  
  return {
    sodium: Math.round(sodium),
    potassium: Math.round(potassium),
    magnesium: Math.round(magnesium)
  };
}

/**
 * Divide electrolytes into doses
 * @param {Object} electrolytes - { sodium, potassium, magnesium }
 * @param {number} numDoses - Number of doses (3 or 4)
 * @returns {Object} Per-dose amounts
 */
function calculateElectrolyteDoses(electrolytes, numDoses = 3) {
  return {
    sodium: Math.round(electrolytes.sodium / numDoses),
    potassium: Math.round(electrolytes.potassium / numDoses),
    magnesium: Math.round(electrolytes.magnesium / numDoses),
    numDoses
  };
}

/**
 * Calculate water reminder intervals
 * @param {number} totalWaterMl - Total daily water in ml
 * @param {number} hoursAwake - Hours awake (default 16)
 * @returns {Object} { intervalMinutes, amountPerReminder }
 */
function calculateWaterReminders(totalWaterMl, hoursAwake = 16) {
  // Remind every 2 hours during awake time
  const intervalMinutes = 120;
  const numReminders = Math.ceil((hoursAwake * 60) / intervalMinutes);
  const amountPerReminder = Math.round(totalWaterMl / numReminders);
  
  return {
    intervalMinutes,
    amountPerReminder,
    numReminders
  };
}

/**
 * Calculate elapsed time since fast start
 * @param {string} startTime - ISO timestamp
 * @returns {Object} { hours, minutes, totalMinutes }
 */
function calculateElapsedTime(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return { hours, minutes, totalMinutes };
}

/**
 * Determine fasting phase based on elapsed hours
 * @param {number} hours - Elapsed hours
 * @returns {Object} { phase, description, milestone }
 */
function getFastingPhase(hours) {
  if (hours < 12) {
    return {
      phase: 'Fed State',
      description: 'Your body is still digesting food and using glucose for energy.',
      milestone: null
    };
  }
  
  if (hours < 16) {
    return {
      phase: 'Ketosis Starting',
      description: 'Your body is beginning to switch to fat burning. Ketone levels are rising.',
      milestone: '12h'
    };
  }
  
  if (hours < 24) {
    return {
      phase: 'Autophagy Initiation',
      description: 'Cellular cleanup (autophagy) is beginning. Your cells are starting to recycle damaged components.',
      milestone: '16-24h'
    };
  }
  
  if (hours < 48) {
    return {
      phase: 'Peak Autophagy / HGH Increase',
      description: 'Human Growth Hormone (HGH) is significantly elevated. Autophagy is in full swing.',
      milestone: '24h+'
    };
  }
  
  if (hours < 72) {
    return {
      phase: 'Deep Ketosis',
      description: 'Your body is efficiently burning fat for fuel. Mental clarity often improves at this stage.',
      milestone: '48h+'
    };
  }
  
  return {
    phase: 'Extended Fast',
    description: 'You are in a deep fasted state. Ensure you are monitoring your body and have medical supervision for fasts longer than 72 hours.',
    milestone: '72h+'
  };
}

/**
 * Check if a milestone notification should be sent
 * Returns the milestone name if a notification should be sent, null otherwise
 * @param {number} hours - Elapsed hours
 * @returns {string|null} Milestone name or null
 */
function checkMilestone(hours) {
  // Milestones at: 12h, 16h, 24h, 48h, 72h
  if (hours >= 72) return '72h';
  if (hours >= 48) return '48h';
  if (hours >= 24) return '24h';
  if (hours >= 16) return '16h';
  if (hours >= 12) return '12h';
  return null;
}

/**
 * Format elapsed time as a readable string
 * @param {number} hours 
 * @param {number} minutes 
 * @returns {string}
 */
function formatElapsedTime(hours, minutes) {
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  return parts.join(' and ') || 'Just started';
}

/**
 * Format milliliters to a readable string
 * @param {number} ml 
 * @returns {string}
 */
function formatWaterAmount(ml) {
  if (ml >= 1000) {
    return `${(ml / 1000).toFixed(1)}L`;
  }
  return `${ml}ml`;
}

module.exports = {
  ACTIVITY_LEVELS,
  LBS_TO_KG,
  IN_TO_CM,
  lbsToKg,
  kgToLbs,
  inchesToCm,
  cmToInches,
  verifyAge,
  calculateWaterIntake,
  calculateElectrolytes,
  calculateElectrolyteDoses,
  calculateWaterReminders,
  calculateElapsedTime,
  getFastingPhase,
  checkMilestone,
  formatElapsedTime,
  formatWaterAmount
};
