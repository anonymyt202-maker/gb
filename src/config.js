'use strict';
require('dotenv').config();
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

module.exports = {
  BOT_TOKEN:       process.env.BOT_TOKEN || '',
  ADMIN_ID:        Number(process.env.ADMIN_ID || 0),
  API_ID:          Number(process.env.API_ID || 0),
  API_HASH:        process.env.API_HASH || '',
  CARD_NUMBER:     process.env.CARD_NUMBER || '5614681256483730',
  STARS_TO_UZS:    Number(process.env.STARS_TO_UZS || 140),
  FRAGMENT_API_URL: process.env.FRAGMENT_API_URL || 'https://api.fragment.com',
  FRAGMENT_API_KEY: process.env.FRAGMENT_API_KEY || '',
  GROQ_API_KEY:    process.env.GROQ_API_KEY || '',
  DB_PATH:         process.env.DB_PATH || path.join(DATA_DIR, 'bot.db'),
  DATA_DIR,
  DB: {
    users:    path.join(DATA_DIR, 'users.json'),
    gifts:    path.join(DATA_DIR, 'gifts.json'),
    deposits: path.join(DATA_DIR, 'deposits.json'),
    channels: path.join(DATA_DIR, 'channels.json'),
    session:  path.join(DATA_DIR, 'tg_session.json'),
    claims:   path.join(DATA_DIR, 'used_claims.json'),
  },
  DAILY_MS: 864e5,
  RATE_LIMIT_MS: 2000,
};
