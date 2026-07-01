'use strict';
const jdb      = require('../database/json');
const sqlite   = require('../database/sqlite');
const fragment = require('../api/fragmentAdapter');
const refSvc   = require('../services/referralService');
const mainKb   = require('../keyboards/mainKeyboard');
const mktKb    = require('../keyboards/marketKeyboard');
const { fUzs, esc } = require('../utils/format');
const { isValidUsername, sanitizeUsername } = require('../utils/validation');
const logger   = require('../utils/logger');
const cfg      = require('../config');

const PLANS = [1, 3, 6, 12];

function getPrices() {
  return {
    1:  sqlite.getSettingNum('premium_1m_price', 500),
    3:  sqlite.getSettingNum('premium_3m_price', 1200),
    6:  sqlite.getSettingNum('premium_6m_price', 2200),
    12: sqlite.getSettingNum('premium_12m_price', 4000),
  };
}

function registerPremiumHandlers(bot, ST) {
  bot.action('mkt_premium', async ctx => {
    await ctx.answerCbQuery();
    const prices = getPrices();
    await ctx.editMessageText(
      `💎 <b>Telegram Premium</b>\n\nPremium obuna muddatini tanlang:`,
      { parse_mode: 'HTML', ...mktKb.premiumPlans(prices) }
    );
  });

  for (const months of PLANS) {
    bot.action(`prem_buy_${months}`, async ctx => {
      await ctx.answerCbQuery();
      const userId = ctx.from.id;
      if (!ST[userId]) ST[userId] = {};
      ST[userId].premMonths = months;
      ST[userId].step       = 'prem_username';
      const prices = getPrices();
      await ctx.editMessageText(
        `💎 <b>${months} oylik Premium</b>\n\n💰 Narx: <b>${prices[months]} ⭐</b>\n\nPremium yuboriladigan @username ni kiriting:`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'mkt_premium' }]] }}
      );
    });
  }

  bot.action('prem_confirm', async ctx => {
    await ctx.answerCbQuery();
    const userId   = ctx.from.id;
    const st       = ST[userId] || {};
    const months   = st.premMonths;
    const username = st.premUsername;
    if (!months || !username) return ctx.editMessageText('❌ Xato. Qayta urinib ko\'ring.', mainKb.back('mkt_premium'));
    await processPremiumPurchase(ctx, userId, months, username, bot, ST);
  });

  bot.action('prem_cancel', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (ST[userId]) { delete ST[userId].premMonths; delete ST[userId].premUsername; }
    await ctx.editMessageText('❌ Bekor qilindi.', mainKb.back());
  });
}

async function handlePremiumUsername(ctx, userId, username, ST, bot) {
  username = sanitizeUsername(username);
  if (!isValidUsername(username)) {
    return ctx.reply('❌ Noto\'g\'ri username. @username yozing:');
  }
  if (!ST[userId]) ST[userId] = {};
  ST[userId].premUsername = username;
  delete ST[userId].step;
  const months   = ST[userId].premMonths;
  const prices   = getPrices();
  const price    = prices[months];
  const stars    = await jdb.getStars(userId);
  await ctx.reply(
    `💎 <b>Premium tasdiqlash</b>\n\n📦 Muddat: <b>${months} oy</b>\n👤 Username: <b>@${esc(username)}</b>\n💰 Narx: <b>${price} ⭐</b>\n\n💼 Hisobingizda: <b>${stars} ⭐</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🟩 Tasdiqlash', callback_data: 'prem_confirm' }],
      [{ text: '🟥 Bekor',      callback_data: 'prem_cancel'  }],
    ]}}
  );
}

async function processPremiumPurchase(ctx, userId, months, username, bot, ST) {
  const prices = getPrices();
  const price  = prices[months];
  const stars  = await jdb.getStars(userId);

  if (stars < price) {
    return ctx.editMessageText(
      `❌ Stars yetarli emas!\n\n💰 Narx: ${price} ⭐\n💼 Sizda: ${stars} ⭐`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '⭐ Stars kiritish', callback_data: 'dep_stars'   }],
        [{ text: '⬅️ Orqaga',          callback_data: 'mkt_premium' }],
      ]}}
    );
  }

  await jdb.deductStars(userId, price);

  if (months === 1) {
    // Manual delivery
    const orderId = sqlite.createOrder({ userId, type: 'premium_buy', amount: months, price, status: 'pending', meta: { username, months, manual: true } });
    await ctx.editMessageText(
      `✅ <b>Buyurtma qabul qilindi!</b>\n\n📋 ID: <code>${orderId}</code>\n💎 ${months} oylik Premium\n👤 @${esc(username)}\n\n⏳ 24 soat ichida qo'lda yuboriladi.`,
      { parse_mode: 'HTML', ...mainKb.back() }
    );
    try {
      await bot.telegram.sendMessage(cfg.ADMIN_ID,
        `💎 <b>Premium buyurtma (QOLDA)</b>\n\n📋 <code>${orderId}</code>\n👤 @${username}\n📦 ${months} oy\n💰 ${price} ⭐\n\nAdmin qo'lda amalga oshirsin!`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: '🟩 Amalga oshirildi', callback_data: `adm_order_approve_${orderId}` }, { text: '🟥 Rad etish', callback_data: `adm_order_reject_${orderId}` }],
        ]}}
      );
    } catch {}
  } else {
    // Auto delivery via API
    await ctx.editMessageText(`⏳ Premium sotib olinmoqda...`);
    const apiRes = await fragment.buyPremium(username, months);
    if (apiRes.ok) {
      const orderId = sqlite.createOrder({ userId, type: 'premium_buy', amount: months, price, status: 'completed', meta: { username, months, api: true } });
      await refSvc.grantPurchaseCommission(userId, 'premium_buy', price, bot);
      await ctx.editMessageText(
        `✅ <b>Premium muvaffaqiyatli sotib olindi!</b>\n\n💎 ${months} oylik Premium\n👤 @${esc(username)}\n📋 Buyurtma: <code>${orderId}</code>`,
        { parse_mode: 'HTML', ...mainKb.back() }
      );
    } else {
      await jdb.addStars(userId, price);
      const orderId = sqlite.createOrder({ userId, type: 'premium_buy', amount: months, price, status: 'rejected', error: apiRes.error, meta: { username, months } });
      logger.error('Premium buy API failed', { userId, username, months, error: apiRes.error });
      await ctx.editMessageText(`❌ Premium sotib olishda xato. Stars qaytarildi.\n\n🔴 ${apiRes.error}`, mainKb.back('mkt_premium'));
      try { await bot.telegram.sendMessage(cfg.ADMIN_ID, `❌ Premium xatosi\n👤 @${username}\n${months} oy\nXato: ${apiRes.error}`, { parse_mode: 'HTML' }); } catch {}
    }
  }

  if (ST[userId]) { delete ST[userId].premMonths; delete ST[userId].premUsername; }
}

module.exports = { registerPremiumHandlers, handlePremiumUsername };
