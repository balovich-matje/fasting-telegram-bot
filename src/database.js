/**
 * Database Module
 * Simple JSON file-based storage (no native dependencies)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default database structure
const defaultDb = {
  users: {},
  fasts: [],
  waterLogs: [],
  weightLogs: [],
  phaseNotifications: [],
  reminderLogs: []
};

// In-memory cache
let dbCache = null;
let lastSave = Date.now();

/**
 * Load database from file
 */
function loadDb() {
  if (dbCache) return dbCache;
  
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      dbCache = JSON.parse(data);
    } else {
      dbCache = { ...defaultDb };
    }
  } catch (err) {
    console.error('Error loading database:', err.message);
    dbCache = { ...defaultDb };
  }
  
  return dbCache;
}

/**
 * Save database to file
 */
function saveDb() {
  if (!dbCache) return;
  
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2));
    lastSave = Date.now();
  } catch (err) {
    console.error('Error saving database:', err.message);
  }
}

/**
 * Auto-save every 5 seconds if there are changes
 */
setInterval(() => {
  if (dbCache && Date.now() - lastSave > 5000) {
    saveDb();
  }
}, 5000);

// Save on process exit
process.on('exit', () => saveDb());
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

// ============= USER OPERATIONS =============

const userOperations = {
  create: (userData) => {
    const db = loadDb();
    db.users[userData.user_id] = {
      user_id: userData.user_id,
      age: userData.age,
      sex: userData.sex,
      weight_kg: userData.weight_kg,
      height_cm: userData.height_cm,
      activity_level: userData.activity_level,
      body_fat_percent: userData.body_fat_percent || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    saveDb();
    return { changes: 1 };
  },

  get: (userId) => {
    const db = loadDb();
    return db.users[userId] || null;
  },

  exists: (userId) => {
    const db = loadDb();
    return !!db.users[userId];
  }
};

// ============= FAST OPERATIONS =============

const fastOperations = {
  start: (userId, targetHours = null, customStartTime = null) => {
    const database = loadDb();
    
    // End any active fast first
    database.fasts.forEach(f => {
      if (f.user_id === userId && f.is_active) {
        f.is_active = false;
        f.end_time = new Date().toISOString();
      }
    });
    
    const newFast = {
      id: Date.now(),
      user_id: userId,
      start_time: customStartTime ? customStartTime.toISOString() : new Date().toISOString(),
      end_time: null,
      is_active: true,
      target_hours: targetHours,
      created_at: new Date().toISOString()
    };
    
    database.fasts.push(newFast);
    saveDb();
    return { lastInsertRowid: newFast.id, fast: newFast };
  },

  stop: (userId) => {
    const db = loadDb();
    let changes = 0;
    
    db.fasts.forEach(f => {
      if (f.user_id === userId && f.is_active) {
        f.is_active = false;
        f.end_time = new Date().toISOString();
        changes++;
      }
    });
    
    saveDb();
    return { changes };
  },

  getActive: (userId) => {
    const db = loadDb();
    return db.fasts
      .filter(f => f.user_id === userId && f.is_active)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0] || null;
  },

  getHistory: (userId, limit = 10) => {
    const db = loadDb();
    return db.fasts
      .filter(f => f.user_id === userId && !f.is_active)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, limit);
  }
};

// ============= WATER LOG OPERATIONS =============

const waterOperations = {
  log: (userId, amountMl) => {
    const db = loadDb();
    db.waterLogs.push({
      id: Date.now(),
      user_id: userId,
      amount_ml: amountMl,
      logged_at: new Date().toISOString()
    });
    saveDb();
    return { changes: 1 };
  },

  getTodayTotal: (userId) => {
    const db = loadDb();
    const today = new Date().toDateString();
    
    return db.waterLogs
      .filter(l => {
        if (l.user_id !== userId) return false;
        const logDate = new Date(l.logged_at).toDateString();
        return logDate === today;
      })
      .reduce((sum, l) => sum + l.amount_ml, 0);
  },

  getTodayLogs: (userId) => {
    const db = loadDb();
    const today = new Date().toDateString();
    
    return db.waterLogs
      .filter(l => {
        if (l.user_id !== userId) return false;
        const logDate = new Date(l.logged_at).toDateString();
        return logDate === today;
      })
      .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
  },

  getLogsSince: (userId, sinceDate) => {
    const db = loadDb();
    const since = new Date(sinceDate);
    
    return db.waterLogs
      .filter(l => l.user_id === userId && new Date(l.logged_at) >= since)
      .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
  },

  getTotalSince: (userId, sinceDate) => {
    const db = loadDb();
    const since = new Date(sinceDate);
    
    return db.waterLogs
      .filter(l => l.user_id === userId && new Date(l.logged_at) >= since)
      .reduce((sum, l) => sum + l.amount_ml, 0);
  }
};

// ============= WEIGHT LOG OPERATIONS =============

const weightOperations = {
  log: (userId, weightKg) => {
    const db = loadDb();
    db.weightLogs.push({
      id: Date.now(),
      user_id: userId,
      weight_kg: weightKg,
      logged_at: new Date().toISOString()
    });
    saveDb();
    return { changes: 1 };
  },

  getLatest: (userId) => {
    const db = loadDb();
    return db.weightLogs
      .filter(l => l.user_id === userId)
      .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || null;
  },

  getHistory: (userId, limit = 30) => {
    const db = loadDb();
    return db.weightLogs
      .filter(l => l.user_id === userId)
      .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
      .slice(0, limit);
  }
};

// ============= PHASE NOTIFICATION OPERATIONS =============

const phaseNotificationOperations = {
  hasBeenNotified: (userId, fastId, phaseName) => {
    const db = loadDb();
    return db.phaseNotifications.some(
      n => n.user_id === userId && n.fast_id === fastId && n.phase_name === phaseName
    );
  },

  markNotified: (userId, fastId, phaseName) => {
    const db = loadDb();
    db.phaseNotifications.push({
      id: Date.now(),
      user_id: userId,
      fast_id: fastId,
      phase_name: phaseName,
      notified_at: new Date().toISOString()
    });
    saveDb();
    return { changes: 1 };
  }
};

// ============= REMINDER OPERATIONS =============

const reminderOperations = {
  log: (userId, reminderType, message) => {
    const db = loadDb();
    db.reminderLogs.push({
      id: Date.now(),
      user_id: userId,
      reminder_type: reminderType,
      message: message,
      sent_at: new Date().toISOString()
    });
    saveDb();
    return { changes: 1 };
  },

  getLastReminder: (userId, reminderType) => {
    const db = loadDb();
    return db.reminderLogs
      .filter(l => l.user_id === userId && l.reminder_type === reminderType)
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0] || null;
  }
};

// Expose db object for direct queries in scheduler
const db = {
  prepare: (query) => {
    // Simple mock for the scheduler's custom query
    return {
      all: () => {
        const database = loadDb();
        // Return active fasts joined with user data
        return database.fasts
          .filter(f => f.is_active)
          .map(f => ({
            ...f,
            ...database.users[f.user_id]
          }));
      }
    };
  }
};

module.exports = {
  db,
  users: userOperations,
  fasts: fastOperations,
  water: waterOperations,
  weight: weightOperations,
  phaseNotifications: phaseNotificationOperations,
  reminders: reminderOperations,
  _save: saveDb // Exposed for testing
};
