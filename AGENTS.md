# Project Overview
Act as an expert software engineer. We are building an open-source Telegram Bot MVP that acts as a personalized fasting tracker. The bot must be designed to run locally on a user's machine (or a VPS) and should be strictly single-user or whitelist-based for this MVP (restricted via a `TELEGRAM_USER_ID` environment variable).

# Tech Stack
* Environment: Node.js
* Framework: Telegraf (or node-telegram-bot-api)
* State/Database: Local JSON file or SQLite (keep it simple for the MVP so it's easy for others to clone and run without setting up Postgres).
* Config: `dotenv` for environment variables.

# Environment Variables
The application must rely on a `.env` file with the following:
* `TELEGRAM_BOT_TOKEN`: The bot token from BotFather.
* `TELEGRAM_USER_ID`: The ID of the admin/user allowed to interact with the bot. Ignore messages from all other IDs.

# Core Features & Requirements

## 1. User Onboarding Flow
When the user types `/start`, initiate a step-by-step wizard to collect the following metrics. Store these in the local database:
* Age
* Sex
* Weight (kg/lbs)
* Height (cm/in)
* Daily physical activity level (Sedentary, Light, Moderate, Active, Very Active)
* Estimated Body Fat % (Optional, can be skipped)

## 2. Fasting Education & Initiation
* Before starting a fast (e.g., via a `/startfast` command), output a pre-written, well-formatted message explaining the general pros and cons of longer fasts. 
* Ask for confirmation to begin the fast. Once confirmed, record the start timestamp.

## 3. Hydration & Electrolyte Engine
Based on the user's onboarding metrics, calculate daily requirements upon starting a fast:
* **Water:** Calculate total daily water intake.
* **Electrolytes:** Calculate required Sodium, Potassium, and Magnesium. 
* **Scheduling:** Divide the daily electrolyte requirement into 3-4 manageable "doses." Divide the water into hourly or bi-hourly reminders.
* **Reminders:** Send push notifications (Telegram messages) when it's time to drink water or take electrolytes. 
* **Interactive Tracking:** Provide inline keyboard buttons on the reminders (e.g., "✅ Drank X ml", "Custom Amount"). Allow the user to manually log water via a `/water [amount]` command.

## 4. Weight Tracking
* Allow the user to input their weight at any time using a command like `/weight [value]`.
* Store these logs with timestamps so the user can track fluctuations throughout the day/fast.

## 4.1. Mathematical Formulas & Logic (Strict Implementation)
Implement the following exact formulas for the bot's calculation engine. Do not invent your own medical formulas. Assume `weight` is in kilograms (kg). If the user inputs pounds (lbs), convert it first (`kg = lbs * 0.453592`).

### A. Age Verification Logic
* **If Age < 14:** Hard stop. The bot must refuse to start a fast and send a warning message: "For your safety, fasting trackers are not suitable for users under 14."
* **If Age >= 14 and < 18:** Soft warning. The bot should say: "Please note: Extended fasting is generally not recommended for growing teenagers. Please consult a doctor." Ask for a final confirmation before proceeding.
* **If Age >= 18:** Proceed normally.

### B. Hydration Calculation (Daily Water Intake)
Normally, humans get about 20% of their daily water from food. During a fast, the bot must compensate for this missing intake.

1.  **Calculate Base Intake:** `Base Water (ml) = Weight (kg) * 35`
2.  **Apply Fasting Compensation:** `Fasting Water (ml) = Base Water * 1.2`
3.  **Apply Activity Modifier (Add to Fasting Water):**
    * Sedentary: `+ 0 ml`
    * Light: `+ 500 ml`
    * Moderate: `+ 1000 ml`
    * Active: `+ 1500 ml`
    * Very Active: `+ 2000 ml`
4.  **Final Output:** `Total Daily Water (ml)`

### C. Electrolyte Calculation (Daily Intake During Fasting)
Extended fasts (24h+) require sodium, potassium, and magnesium to prevent "keto flu" and muscle cramps. Implement these baseline requirements:

1.  **Sodium (Na):**
    * Base requirement: `3000 mg`
    * If Activity is Moderate: `+ 500 mg`
    * If Activity is Active or Very Active: `+ 1000 mg`
2.  **Potassium (K):**
    * Base requirement: `2000 mg`
    * If Activity is Active or Very Active: `+ 500 mg`
3.  **Magnesium (Mg):**
    * Base requirement: `300 mg`
    * If Activity is Active or Very Active: `+ 100 mg`

*Formatting Requirement for the Bot:* When displaying these numbers to the user, the bot should suggest splitting the total amounts into 3 or 4 doses mixed with their water throughout the day to avoid stomach upset.


## 5. Fasting Phase Updates
Implement a cron job or background interval that checks the elapsed time of the active fast. Send proactive updates to the user when they hit key milestones. Examples:
* 12 hours: Ketosis starting.
* 16-24 hours: Autophagy initiation.
* 24+ hours: Peak autophagy / HGH increase.
* Provide an ongoing status check via a `/status` command (shows elapsed time, current phase, water consumed vs goal).

# MVP Implementation Steps
1. **Initialize Project:** Set up the Node.js project, install dependencies, and create the basic bot polling structure with the ID whitelist check.
2. **Setup State Management:** Create a simple SQLite schema or JSON handler to save the user profile, active fast details, and logs (weight/water).
3. **Build Conversational Wizard:** Implement the Telegraf Scenes or sequential handlers for the onboarding flow.
4. **Implement Math & Logic:** Write the helper functions for calculating baseline water and electrolyte needs based on the user's profile.
5. **Implement Schedulers:** Use `node-cron` or standard `setInterval` to handle phase alerts and hydration reminders.
6. **Command Handlers:** Wire up `/startfast`, `/stopfast`, `/status`, `/weight`, and `/water`.

# Output Constraints
* Write clean, well-documented, and modular code.
* Do not give me generic advice; output the actual project structure and the code files necessary to get this MVP running immediately.
* Include a `README.md` template instructing future users how to clone the repo, set up their `.env` with BotFather, and start the script.