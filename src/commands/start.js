'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const refSvc = require('../services/referralService');
const mainKb = require('../keyboards/mainKeyboard');
const cfg    = require('../config');
const { esc } = require('../utils/format');

async function handleStart(ctx, ST) {
  const user    = ctx.from;
  const userId  = user.id;
  const payload = ctx.startPayload || '';

  // Ensure ST slot
  if (!ST[userId]) ST[userId] = {};

  // Register / update user
  const existing = await jdb.getUser(userId);
  if (!existing) {
    await jdb.addUser(userId, user.username || '', null);
    await jdb.upsertUser(userId, {
      firstName: user.first_name || '',
      lastName:  user.last_name  || '',
      joinedAt:  new Date().toISOString(),
    });
  } else {
    // Update username in case it changed
    await jdb.upsertUser(userId, {
      username:  user.username  || existing.username,
      firstName: user.first_name || existing.firstName,
      lastName:  user.last_name  || existing.lastName,
    });
  }

  // Handle referral link ?start=ref_<inviterId>
  if (!existing && payload.startsWith('ref_')) {
    const inviterId = parseInt(payload.replace('ref_', ''), 10);
    if (!isNaN(inviterId) && inviterId !== userId) {
      await refSvc.applyStartReferral(userId, inviterId);
    }
  }

  // Check maintenance
  if (sqlite.getSettingBool('maintenance_mode', false)) {
    const isAdmin = Number(userId) === cfg.ADMIN_ID || sqlite.isAdmin(userId);
    if (!isAdmin) {
      return ctx.reply('🔧 Bot texnik ishlar uchun vaqtinchalik to\'xtatildi. Iltimos, keyinroq qayta urinib ko\'ring.');
    }
  }

  // Check mandatory channel membership
  const channels = await jdb.getSubChannels();
  const required = channels.filter(c => c.required);
  const missing  = [];
  for (const ch of required) {
    try {
      const member = await ctx.telegram.getChatMember(ch.id, userId);
      if (['left','kicked'].includes(member.status)) missing.push(ch);
    } catch { missing.push(ch); }
  }
  if (missing.length) {
    const links = missing.map(c => `• ${c.title || c.id}`).join('\n');
    return ctx.reply(
      `⚠️ Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling:\n\n${links}\n\nA'zo bo'lgach /start ni bosing.`,
      { reply_markup: { inline_keyboard: [
        ...missing.map(c => [{ text: `📢 ${c.title || c.id}`, url: `https://t.me/${String(c.id).replace('@','')}` }]),
        [{ text: '✅ Tekshirish', callback_data: 'check_join' }],
      ]}}
    );
  }

  const welcome = sqlite.getSetting('welcome_text') ||
    `Salom, <b>${esc(user.first_name)}</b>! 👋\n\n` +
    `Xush kelibsiz! Bu bot orqali Stars sotib olish, sotish, Telegram Premium va TON xarid qilish mumkin.\n\n` +
    `Quyidagi tugmalardan birini tanlang:`;

  const dbUser = await jdb.getUser(userId);
  await ctx.reply(welcome, {
    parse_mode: 'HTML',
    ...mainKb.main(dbUser),
  });
}

module.exports = { handleStart };
