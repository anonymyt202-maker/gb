'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const { tmeUrl } = require('../utils/format');
const cfg    = require('../config');

async function isSubscribed(bot, userId) {
  try {
    const chs = await jdb.getSubChannels();
    if (!chs.length) return true;
    for (const ch of chs) {
      const handle = String(ch).startsWith('@') ? ch : `@${ch}`;
      try {
        const m = await bot.telegram.getChatMember(handle, userId);
        if (!['member', 'administrator', 'creator', 'restricted'].includes(m.status)) return false;
      } catch { return false; }
    }
    return true;
  } catch { return true; }
}

async function subsKeyboard(bot) {
  const chs  = await jdb.getSubChannels();
  const rows = chs.filter(Boolean).map(ch => [{ text: `📢 ${ch}`, url: tmeUrl(ch) }]);
  rows.push([{ text: '✅ Tekshirish', callback_data: 'check_subs' }]);
  return rows;
}

function requireSubscription(bot) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (userId === cfg.ADMIN_ID || sqlite.isAdmin(userId)) return next();
    const ok = await isSubscribed(bot, userId);
    if (!ok) {
      const rows = await subsKeyboard(bot);
      const args = ctx.startPayload || '';
      if (args) {
        const u = await jdb.getUsers();
        const i = u.findIndex(x => Number(x.userId) === userId);
        if (i !== -1 && !u[i].invitedBy && /^\d+$/.test(args) && Number(args) !== userId) {
          u[i].invitedBy = Number(args);
          await jdb.saveUsers(u);
        }
      }
      return ctx.reply('📢 Botdan foydalanish uchun kanallarga obuna bo\'ling!', {
        reply_markup: { inline_keyboard: rows },
      });
    }
    return next();
  };
}

module.exports = { isSubscribed, subsKeyboard, requireSubscription };
