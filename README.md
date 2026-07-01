# Telegram Gift Marketplace Bot

A full-featured commercial Telegram bot for Stars buy/sell, Telegram Premium, TON crypto trading, referral system, UZS payments, and AI assistance.

## Quick Start

```bash
cd bot
cp .env.example .env
# Fill in .env with your values
npm install
npm start
```

## Features

- ⭐ **Stars Buy/Sell** — Buy Telegram Stars with UZS, sell Stars to admin channel
- 💎 **Telegram Premium** — Purchase 1/3/6/12 month Premium plans using Stars
- 💰 **TON Trading** — Buy/Sell TON cryptocurrency with dynamic pricing
- 💳 **UZS Deposits** — Card-based UZS deposits with proof photos
- 🎁 **Gift Sending** — Send Telegram gifts via GramJS (session-based)
- 👥 **Referral System** — 7-day locked Star rewards + purchase commissions
- 🔄 **Stars → UZS Conversion** — Convert Stars balance to UZS
- 📦 **Orders System** — Full order tracking with statuses
- 🤖 **Groq AI Assistant** — AI-powered help (Llama 3.3 70B)
- ⚙️ **Multi-Admin Panel** — Scoped admin permissions
- 📢 **Channel Manager** — Mandatory subscription gates
- 📊 **Statistics** — Full user/order/referral analytics

## Required Environment Variables

```env
BOT_TOKEN=         # Telegram Bot Token from @BotFather
ADMIN_ID=          # Your Telegram user ID (super admin)
CARD_NUMBER=       # Card number for UZS deposits
SESSION_SECRET=    # Any random secret for session encryption
```

## Optional Environment Variables

```env
ADMIN_USERNAME=    # Admin Telegram username (without @)
GROQ_API_KEY=      # Groq API key for AI features
API_KEY=           # External API key (Fragment etc.)
API_BASE_URL=      # External API base URL
FRAGMENT_URL=      # Fragment.com API URL

# GramJS (for gift sending)
API_ID=            # Telegram API ID from my.telegram.org
API_HASH=          # Telegram API Hash
SESSION_STRING=    # GramJS session string

DATA_DIR=./data    # JSON data directory (default: ./data)
DB_PATH=./data/bot.db  # SQLite database path
```

## Architecture

```
bot/
├── src/
│   ├── index.js              # Main entry point, bot launch, message router
│   ├── config.js             # Environment & configuration
│   ├── commands/
│   │   └── start.js          # /start handler with referral & channel check
│   ├── handlers/             # Feature handlers (gift, stars, premium, ton, etc.)
│   ├── admin/                # Admin panel modules (one per feature area)
│   ├── services/
│   │   └── referralService.js
│   ├── database/
│   │   ├── json.js           # JSON file persistence (backward compat)
│   │   └── sqlite.js         # SQLite for orders, admins, settings, referrals
│   ├── keyboards/
│   │   ├── mainKeyboard.js   # User-facing keyboards
│   │   ├── adminKeyboard.js  # Admin keyboards
│   │   └── marketKeyboard.js # Market/trade keyboards
│   ├── utils/
│   │   ├── format.js         # Number formatting, pagination helpers
│   │   ├── validation.js     # Input validation
│   │   ├── gramjs.js         # GramJS wrapper for gift sending
│   │   └── logger.js         # Winston logger
│   ├── middlewares/
│   │   ├── auth.js           # Auth middleware
│   │   └── adminCheck.js     # Admin permission check
│   ├── ai/
│   │   └── groqService.js    # Groq AI integration
│   └── api/
│       └── fragmentAdapter.js # External API adapter
├── data/                     # JSON data files & SQLite DB
├── package.json
└── .env.example
```

## Data Files (JSON — backward compatible)

| File | Purpose |
|------|---------|
| `data/users.json` | User balances and profiles |
| `data/gifts.json` | Gift records |
| `data/deposits.json` | UZS deposit records |
| `data/channels.json` | Mandatory subscription channels |
| `data/claims.json` | Gift claim records |

## SQLite Tables (new)

| Table | Purpose |
|-------|---------|
| `orders` | Full order history (buy/sell/deposit) |
| `admins` | Additional admins with scoped permissions |
| `settings` | Bot configuration key-value store |
| `referral_ledger` | Referral rewards with lock/unlock tracking |
| `rate_limits` | Per-user rate limiting |
| `logs` | Audit log |

## Admin Commands

- `/admin` — Open admin panel
- `/balance` — Check your balance
- `/ref` — Your referral link and stats

## Admin Panel Sections

| Section | Description |
|---------|-------------|
| 👥 Users | Search users, add Stars/UZS, approve deposits |
| 📦 Orders | View/approve/reject orders by status |
| ⭐ Stars | Set buy/sell prices, enable/disable trading |
| 💎 Premium | Set plan prices (1/3/6/12 months) |
| 💰 TON | Set buy/sell prices and fee percentages |
| 👥 Referral | Set bonus amounts, lock days, commission % |
| 🔌 API | Configure external API keys and URLs |
| 📢 Channels | Manage mandatory subscription channels |
| ⚙️ Settings | Global bot settings, maintenance mode, card |
| 🔐 Permissions | Add/remove admins, set per-scope permissions |
| 📢 Broadcast | Send messages to all users |
| 📊 Stats | User and order statistics |

## GramJS Session Setup

To enable gift sending via GramJS:

1. Get `API_ID` and `API_HASH` from https://my.telegram.org
2. Generate a session string:
   ```bash
   node -e "const { TelegramClient } = require('telegram'); const { StringSession } = require('telegram/sessions'); (async () => { const s = new StringSession(''); const c = new TelegramClient(s, parseInt(process.env.API_ID), process.env.API_HASH, {}); await c.start({ phoneNumber: async () => require('readline').createInterface({input: process.stdin}).question('Phone: ', r => r), password: async () => require('readline').createInterface({input: process.stdin}).question('Password: ', r => r), phoneCode: async () => require('readline').createInterface({input: process.stdin}).question('Code: ', r => r), onError: e => console.error(e) }); console.log('SESSION:', c.session.save()); })();"
   ```
3. Set `SESSION_STRING=` in `.env`
