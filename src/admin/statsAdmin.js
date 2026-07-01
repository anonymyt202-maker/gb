'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const { fUzs } = require('../utils/format');

function registerStatsAdmin(bot, ST) {
  bot.action('adm_stats', async ctx => {
    await ctx.answerCbQuery();
    await showStats(ctx);
  });
}

async function showStats(ctx) {
  const users   = await jdb.getUsers();
  const orders  = sqlite.getAllOrders(9999);
  const pending = orders.filter(o => o.status === 'pending').length;
  const done    = orders.filter(o => o.status === 'completed').length;
  const rej     = orders.filter(o => o.status === 'rejected').length;

  const today = new Date(); today.setHours(0,0,0,0);
  const todayUsers  = users.filter(u => new Date(u.joinedAt) >= today).length;
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today).length;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekUsers = users.filter(u => new Date(u.joinedAt) >= weekAgo).length;

  const totalStars = users.reduce((a, u) => a + (u.stars || 0), 0);
  const totalUzs   = users.reduce((a, u) => a + (u.uzs   || 0), 0);
  const totalRefs  = sqlite.getTotalReferrals();
  const totalComm  = sqlite.getTotalCommissions();

  await ctx.editMessageText(
    `📊 <b>Statistika</b>\n\n` +
    `👥 Foydalanuvchilar:\n` +
    `   Jami: <b>${users.length}</b>\n` +
    `   Bugun: +${todayUsers}\n` +
    `   Hafta: +${weekUsers}\n\n` +
    `📦 Buyurtmalar:\n` +
    `   Jami: <b>${orders.length}</b>\n` +
    `   Bugun: ${todayOrders}\n` +
    `   ✅ Tugagan: ${done}\n` +
    `   ⏳ Kutmoqda: ${pending}\n` +
    `   ❌ Rad: ${rej}\n\n` +
    `💰 Balanslar:\n` +
    `   ⭐ Jami Stars: ${totalStars}\n` +
    `   💵 Jami UZS: ${fUzs(totalUzs)}\n\n` +
    `👥 Referral:\n` +
    `   Jami reflar: ${totalRefs}\n` +
    `   Jami komisyon: ${totalComm} ⭐`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🔄 Yangilash', callback_data: 'adm_stats' }],
      [{ text: '⬅️ Admin',    callback_data: 'adm_panel' }],
    ]}}
  );
}

module.exports = { registerStatsAdmin };
