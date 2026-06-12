/**
 * app.js — Asosiy kirish nuqtasi
 * Express server + Telegraf bot birga
 * (Python run.py ning Node.js versiyasi)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cfg = require('./config');
const routes = require('./routes');
const bot = require('./bot');

const app = express();

// ─── Middlewares ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static fayllar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/static', express.static(path.join(__dirname, 'static')));

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api', routes);

// ─── WebApp HTML ──────────────────────────────────────────────────
app.get('/webapp/user', (_, res) => res.sendFile(path.join(__dirname, 'web', 'index.html')));
app.get('/webapp/admin', (_, res) => res.sendFile(path.join(__dirname, 'web', 'admin.html')));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0' }));

// Root
app.get('/', (_, res) => res.json({ name: 'RM Gift Bot', status: 'running' }));

// ─── Start ────────────────────────────────────────────────────────
const PORT = cfg.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`✅ Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`📱 WebApp: ${cfg.API_BASE_URL}/webapp/user`);
  console.log(`🔧 Admin: ${cfg.API_BASE_URL}/webapp/admin`);
});

// Bot ishga tushirish
if (cfg.BOT_TOKEN && cfg.BOT_TOKEN !== 'your_bot_token_here') {
  bot.launch().then(() => {
    console.log('🤖 Bot ishga tushdi!');
  }).catch(err => {
    console.error('❌ Bot xato:', err.message);
  });

  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('⚠️  BOT_TOKEN topilmadi. Bot ishlamaydi.');
}
