# 🧘 Fasting Tracker Bot

A personalized fasting tracker Telegram Bot that helps you monitor your fasts, stay hydrated, and track electrolyte intake. Designed for single-user or whitelist-based usage.

## ✨ Features

- **👤 User Onboarding** - Step-by-step wizard to collect your metrics (age, sex, weight, height, activity level, body fat %)
- **🚫 Age Verification** - Hard stop for users under 14, warning for teenagers
- **💧 Hydration Tracking** - Calculates daily water needs based on your weight and activity
- **🧂 Electrolyte Management** - Calculates sodium, potassium, and magnesium requirements
- **⏰ Smart Reminders** - Water reminders every 30 minutes, electrolyte reminders every 6 hours
- **📊 Fasting Phase Updates** - Notifications at key milestones (12h, 16h, 24h, 48h, 72h)
- **📈 Weight & Water Logging** - Track your progress over time
- **🔒 Single-User Mode** - Restricted access via environment variable

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- A Telegram account

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd fasting-telegram-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Start a chat and send `/newbot`
3. Follow the prompts to name your bot
4. Copy the **HTTP API token** provided

### 4. Set Up the Menu Button (Recommended)

The **"Menu"** button appears next to the message input field:

1. Go to **@BotFather**
2. Send `/mybots` and select your bot
3. Tap **Bot Settings** → **Menu Button**
4. Select **Configure menu button**
5. Enter button text: `Menu`
6. Enter URL (can be any valid URL like `https://t.me/your_bot_username`)

This creates the Menu button that users can tap. The bot will then show the menu keyboard.

### 5. Set Up Command Suggestions (Recommended)

To show command suggestions when typing `/`:

1. In **@BotFather** chat, send: `/setcommands`
2. Select your bot from the list
3. Paste the following command list:

```
start - Start the bot and set up profile
menu - Show main menu with buttons
startfast - Start a new fasting session
stopfast - End current fast
status - Check fasting status
water - Log water intake (e.g., /water 250)
weight - Log weight (e.g., /weight 75kg)
info - Show fasting education and tips
help - Show all available commands
```

### 6. Get Your Telegram User ID

1. Search for **@userinfobot** on Telegram
2. Start the bot
3. Copy your **Id** number

### 7. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_ID=your_telegram_user_id_here
```

### 8. Start the Bot

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

### 9. Deploy to VPS (Optional)

To run the bot 24/7 on a VPS/server:

**Using PM2 (Recommended):**

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot with PM2
pm2 start src/index.js --name fasting-bot

# Save PM2 config to auto-start on boot
pm2 save
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status              # Check if bot is running
pm2 logs fasting-bot    # View bot logs
pm2 restart fasting-bot # Restart the bot
pm2 stop fasting-bot    # Stop the bot
```

**Alternative (simple, no auto-restart):**
```bash
nohup npm start > bot.log 2>&1 &
```

## 📱 Usage

Once the bot is running, open Telegram and start chatting with your bot:

### Getting Started

1. Send `/start` to begin the onboarding process
2. Answer the questions about your age, sex, weight, height, and activity level
3. Your profile will be saved to the local database
4. Use the **Menu** button or `/menu` command to see available options

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Set up or update your profile |
| `/menu` | Show main menu with buttons |
| `/startfast` | Start a new fasting session |
| `/stopfast` | End your current fast and see a summary |
| `/status` | Check your current fast progress and phase |
| `/water [amount]` | Log water intake (e.g., `/water 250`, `/water 1 cup`) |
| `/weight [value]` | Log your weight (e.g., `/weight 75 kg`, `/weight 165 lbs`) |
| `/info` | Show fasting education and information |
| `/help` | Show all available commands |

### Water Input Formats

The `/water` command accepts various formats:
- `250` or `250ml` - milliliters
- `1 cup` or `1 glass` - standard sizes
- `16 oz` - fluid ounces
- `0.5 l` - liters

### Weight Input Formats

The `/weight` command accepts:
- `75` or `75 kg` - kilograms
- `165 lbs` - pounds

## 🧮 Calculations

The bot uses scientifically-based formulas for all calculations:

### Daily Water Intake

```
Base Water (ml) = Weight (kg) × 35
Fasting Water (ml) = Base Water × 1.2
Activity Modifier:
  - Sedentary: +0 ml
  - Light: +500 ml
  - Moderate: +1000 ml
  - Active: +1500 ml
  - Very Active: +2000 ml
```

### Daily Electrolytes (24h+ fasts)

| Electrolyte | Base | Moderate Activity | Active/Very Active |
|-------------|------|-------------------|-------------------|
| Sodium | 3000mg | +500mg | +1000mg |
| Potassium | 2000mg | - | +500mg |
| Magnesium | 300mg | - | +100mg |

## 🗂️ Project Structure

```
fasting-telegram-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── database.js           # JSON file database
│   ├── calculations.js       # Math formulas
│   ├── scenes/
│   │   └── onboarding.js     # Onboarding wizard
│   ├── commands/
│   │   ├── startfast.js      # /startfast handler
│   │   ├── stopfast.js       # /stopfast handler
│   │   ├── status.js         # /status handler
│   │   ├── water.js          # /water handler
│   │   ├── weight.js         # /weight handler
│   │   ├── info.js           # /info handler
│   │   ├── menu.js           # /menu handler
│   │   └── help.js           # /help handler
│   └── utils/
│       └── scheduler.js      # Reminder scheduler
├── data/                     # Database files
├── .env                      # Environment variables
├── .env.example              # Example env file
├── package.json
└── README.md
```

## 🔒 Security Notes

- The bot is strictly single-user via the `TELEGRAM_USER_ID` environment variable
- All messages from other users are ignored
- Data is stored locally in a JSON file (`data/database.json`)
- No data is sent to external services except Telegram's API

## ⚠️ Disclaimer

This bot is for educational and tracking purposes only. It is not medical advice.

- **Do not use** if you are under 14 years old
- **Consult a doctor** before extended fasting (24+ hours)
- **Stop immediately** if you feel unwell (dizziness, severe weakness, etc.)
- Extended fasts (48+ hours) should be done with medical supervision

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** [Telegraf](https://telegraf.js.org/) (Telegram Bot Framework)
- **Database:** JSON file storage
- **Scheduling:** node-cron
- **Environment:** dotenv

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the fasting community.
