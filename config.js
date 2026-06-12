require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(x => parseInt(x.trim())).filter(Boolean),
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  PORT: parseInt(process.env.PORT) || 3000,

  // Telegram MTProto (gift yuborish uchun — ixtiyoriy)
  API_ID: parseInt(process.env.API_ID) || 0,
  API_HASH: process.env.API_HASH || '',

  // To'lov
  CARD_NUMBER: process.env.CARD_NUMBER || '0000000000000000',
  CARD_HOLDER: process.env.CARD_HOLDER || 'KARTA EGASI',

  // Majburiy kanal
  REQUIRED_CHANNEL: process.env.REQUIRED_CHANNEL || '',

  // RM Coin kurslar
  RM_TO_STARS: parseFloat(process.env.RM_TO_STARS) || 1.0,   // 1 RM = 1 Stars
  RM_TO_UZS:   parseFloat(process.env.RM_TO_UZS)   || 150.0, // 1 RM = 150 so'm

  // Referral
  REFERRAL_REWARD: parseFloat(process.env.REFERRAL_REWARD) || 1.0,

  // DB
  DB_PATH: process.env.DB_PATH || './rmbot.db',
};
