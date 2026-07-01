'use strict';
const jdb      = require('../database/json');
const sqlite   = require('../database/sqlite');
const fragment = require('../api/fragmentAdapter');
const refSvc   = require('../services/referralService');
const mainKb   = require('../keyboards/mainKeyboard');
const { fUzs, esc } = require('../utils/format');
const { isValidInt, sanitizeAmount } = require('../utils/validation');
const logger   = require('../utils/logger');
const cfg      = require('../config');

function registerStarsHandlers(bot, ST) {

  // ── BUY STARS menu ────────────────────────────────────────────
  bot.action('mkt_buy_stars', async ctx => {
    await ctx.answerCbQuery();
    const enabled = sqlite.getSettingBool('star_buy_enabled', true);
    if (!enabled) return ctx.editMessageText('⭐ Stars sotib olish hozir o\'chirilgan.', mainKb.back());
    const minAmt  = sqlite.getSettingNum('star_min_buy', 10);
    const price1  = sqlite.getSettingNum('star_buy_price', cfg.STARS_TO_UZS);
    await ctx.editMessageText(
      `⭐ <b>Stars sotib olish</b>\n\n💰 1 Star = <b>${fUzs(price1)}</b>\n📦 Minimum: <b>${minAmt} Stars</b>\n\nNechta Stars sotib olmoqchisiz?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '50 ⭐',   callback_data: 'stars_buy_amt_50'   }, { text: '100 ⭐',  callback_data: 'stars_buy_amt_100'  }],
        [{ text: '250 ⭐',  callback_data: 'stars_buy_amt_250'  }, { text: '500 ⭐',  callback_data: 'stars_buy_amt_500'  }],
        [{ text: '1000 ⭐', callback_data: 'stars_buy_amt_1000' }, { text: '✏️ O\'zgartirish', callback_data: 'stars_buy_custom' }],
        [{ text: '⬅️ Orqaga', callback_data: 'main' }],
      ]}}
    );
  });

  // Quick amount buttons
  bot.action(/^stars_buy_amt_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const amount = parseInt(ctx.match[1], 10);
    await showStarsBuyConfirm(ctx, amount, ST);
  });

  // Custom amount
  bot.action('stars_buy_custom', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'stars_buy_amount';
    await ctx.editMessageText('⭐ Nechta Stars sotib olmoqchisiz? Miqdorni kiriting:', {
      reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] },
    });
  });

  // Confirm buy
  bot.action('stars_buy_confirm', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const st     = ST[userId] || {};
    const amount = st.starsBuyAmt;
    if (!amount) return ctx.editMessageText('❌ Xato. Qayta urinib ko\'ring.', mainKb.back());
    await processBuyStars(ctx, userId, amount, st, bot, ST);
  });

  // ── SELL STARS menu ───────────────────────────────────────────
  bot.action('mkt_sell_stars', async ctx => {
    await ctx.answerCbQuery();
    const enabled = sqlite.getSettingBool('star_sell_enabled', true);
    if (!enabled) return ctx.editMessageText('⭐ Stars sotish hozir o\'chirilgan.', mainKb.back());
    const channelId = sqlite.getSetting('stars_sell_channel');
    let channelInfo = '';
    if (channelId) channelInfo = `\n\n📢 Stars sotish kanali: ${channelId}`;
    await ctx.editMessageText(
      `⭐ <b>Stars sotish</b>\n\nStars sotish uchun quyidagi kanalga boring va Stars bilan reaksiya qo\'ying.${channelInfo}\n\nKeyin botga qaytib kelib, Stars miqdorini bildiring.`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        ...(channelId ? [[{ text: '📢 Kanalga o\'tish', url: channelId.startsWith('https') ? channelId : `https://t.me/${channelId.replace('@', '')}` }]] : []),
        [{ text: '✅ Stars yubordim', callback_data: 'sell_stars_sent' }],
        [{ text: '⬅️ Orqaga', callback_data: 'main' }],
      ]}}
    );
  });

  bot.action('sell_stars_sent', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (sqlite.hasPendingOrder(userId, 'stars_sell')) {
      return ctx.editMessageText('⏳ Sizda allaqachon kutilayotgan buyurtma bor. Iltimos kuting.', mainKb.back());
    }
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'stars_sell_amount';
    await ctx.editMessageText('⭐ Nechta Stars yubordingiz?', {
      reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] },
    });
  });
}

async function showStarsBuyConfirm(ctx, amount, ST) {
  const userId  = ctx.from.id;
  const minAmt  = sqlite.getSettingNum('star_min_buy', 10);
  const price1  = sqlite.getSettingNum('star_buy_price', cfg.STARS_TO_UZS);
  if (amount < minAmt) {
    return ctx.editMessageText(`❌ Minimum ${minAmt} Stars sotib olish mumkin.`, mainKb.back('mkt_buy_stars'));
  }
  const totalPrice = amount * price1;
  if (!ST[userId]) ST[userId] = {};
  ST[userId].starsBuyAmt = amount;
  await ctx.editMessageText(
    `⭐ <b>Stars sotib olish — Tasdiqlash</b>\n\n📦 Miqdor: <b>${amount} Stars</b>\n💰 Narx: <b>${fUzs(totalPrice)}</b>\n\nTo\'lov UZS hisobidan amalga oshiriladi.`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🟩 Tasdiqlash', callback_data: 'stars_buy_confirm' }],
      [{ text: '🟥 Bekor',      callback_data: 'mkt_buy_stars'     }],
    ]}}
  );
}

async function processBuyStars(ctx, userId, amount, st, bot, ST) {
  const price1     = sqlite.getSettingNum('star_buy_price', cfg.STARS_TO_UZS);
  const totalPrice = amount * price1;
  const uzsBalance = await jdb.getUzs(userId);

  if (uzsBalance < totalPrice) {
    return ctx.editMessageText(
      `❌ <b>UZS yetarli emas!</b>\n\n💰 Kerak: ${fUzs(totalPrice)}\n💵 Sizda: ${fUzs(uzsBalance)}`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '💵 UZS kiritish', callback_data: 'dep_uzs' }],
        [{ text: '⬅️ Orqaga',       callback_data: 'mkt_buy_stars' }],
      ]}}
    );
  }

  // Check API
  const balRes = await fragment.checkBalance();
  if (balRes.ok && balRes.balance !== null && balRes.balance < amount) {
    const orderId = sqlite.createOrder({ userId, type: 'stars_buy', amount, price: totalPrice, status: 'pending', meta: { note: 'API balance low, queued' } });
    await ctx.editMessageText(`⏳ Hozir Stars yetarli emas. Buyurtmangiz navbatda: <code>${orderId}</code>`, { parse_mode: 'HTML', ...mainKb.back() });
    try { await bot.telegram.sendMessage(cfg.ADMIN_ID, `⭐ Stars buyurtma kutmoqda\n🆔 ${orderId}\n👤 ${userId}\nMiqdor: ${amount}\nAPI balans past.`, { parse_mode: 'HTML' }); } catch {}
    return;
  }

  await ctx.editMessageText('⏳ Stars sotib olinmoqda...');
  await jdb.deductUzs(userId, totalPrice);

  const user   = await jdb.getUser(userId);
  const uname  = (user?.username || '').replace('@', '');

  const apiRes = await fragment.buyStars(uname || String(userId), amount);

  if (apiRes.ok) {
    await jdb.addStars(userId, amount);
    const orderId = sqlite.createOrder({ userId, type: 'stars_buy', amount, price: totalPrice, status: 'completed', meta: { api: true } });
    await refSvc.grantPurchaseCommission(userId, 'stars_buy', amount, bot);
    await ctx.editMessageText(
      `✅ <b>Stars muvaffaqiyatli sotib olindi!</b>\n\n⭐ <b>+${amount} Stars</b>\n📋 Buyurtma: <code>${orderId}</code>`,
      { parse_mode: 'HTML', ...mainKb.back() }
    );
  } else {
    // Refund UZS
    await jdb.addUzs(userId, totalPrice);
    const orderId = sqlite.createOrder({ userId, type: 'stars_buy', amount, price: totalPrice, status: 'rejected', error: apiRes.error, meta: {} });
    logger.error('Stars buy API failed', { userId, amount, error: apiRes.error });
    await ctx.editMessageText(`❌ Stars sotib olishda xato. UZS qaytarildi.\n\n🔴 ${apiRes.error}`, mainKb.back());
    try { await bot.telegram.sendMessage(cfg.ADMIN_ID, `❌ Stars xatosi\n👤 ${userId}\nMiqdor: ${amount}\nXato: ${apiRes.error}`, { parse_mode: 'HTML' }); } catch {}
  }

  if (ST[userId]) delete ST[userId].starsBuyAmt;
}

async function processStarsSellOrder(ctx, userId, amount, bot, ST) {
  if (!ST[userId]) ST[userId] = {};
  ST[userId].starsSellAmt  = amount;
  ST[userId].step          = 'stars_sell_proof';
  await ctx.reply(
    `📸 Iltimos Stars yuborgan ekraningizni yuboring (screenshot yoki check):`,
    { reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
  );
}

async function finalizeStarsSell(ctx, userId, proofFileId, bot, ST) {
  const amount = ST[userId]?.starsSellAmt;
  if (!amount) return ctx.reply('❌ Xato. Qayta urinib ko\'ring.');
  const orderId = sqlite.createOrder({
    userId, type: 'stars_sell', amount,
    status: 'pending', proof: proofFileId,
    meta: { username: (await jdb.getUser(userId))?.username },
  });
  delete ST[userId].starsSellAmt;
  delete ST[userId].step;
  await ctx.reply(
    `✅ <b>Buyurtma qabul qilindi!</b>\n\n📋 ID: <code>${orderId}</code>\n⭐ Miqdor: ${amount} Stars\n\n⏳ Admin ko'rib chiqadi va to'lov qiladi.`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  // Notify admins
  const user = await jdb.getUser(userId);
  try {
    await bot.telegram.sendMessage(cfg.ADMIN_ID,
      `⭐ <b>Stars Sell buyurtma</b>\n\n📋 <code>${orderId}</code>\n👤 ${user?.username || userId} (<code>${userId}</code>)\n⭐ Miqdor: <b>${amount} Stars</b>\n\n📸 Chek yuborilgan.`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🟩 Tasdiqlash', callback_data: `adm_order_approve_${orderId}` }, { text: '🟥 Rad etish', callback_data: `adm_order_reject_${orderId}` }],
      ]}}
    );
    if (proofFileId) await bot.telegram.sendPhoto(cfg.ADMIN_ID, proofFileId, { caption: `Chek: ${orderId}` });
  } catch {}
}

module.exports = { registerStarsHandlers, showStarsBuyConfirm, processStarsSellOrder, finalizeStarsSell };
