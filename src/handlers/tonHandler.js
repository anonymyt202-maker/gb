'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const refSvc = require('../services/referralService');
const mainKb = require('../keyboards/mainKeyboard');
const { fUzs, esc } = require('../utils/format');
const { isValidAmount, sanitizeAmount } = require('../utils/validation');
const logger = require('../utils/logger');
const cfg    = require('../config');

function registerTonHandlers(bot, ST) {
  // ── BUY TON ────────────────────────────────────────────────────
  bot.action('mkt_buy_ton', async ctx => {
    await ctx.answerCbQuery();
    const base = sqlite.getSettingNum('ton_buy_base_price', 19000);
    const pct  = sqlite.getSettingNum('ton_buy_pct', 10);
    const price = Math.round(base * (1 + pct / 100));
    const wallet = sqlite.getSetting('ton_wallet') || 'Sozlanmagan';
    await ctx.editMessageText(
      `💰 <b>TON sotib olish</b>\n\n📊 Narx: <b>${fUzs(price)}</b> / 1 TON\n(Baza: ${fUzs(base)} + ${pct}%)\n\n🏦 TON ko'chirish manzili:\n<code>${wallet}</code>\n\nNechta TON sotib olmoqchisiz?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '1 TON',  callback_data: 'ton_buy_amt_1'  }, { text: '5 TON',  callback_data: 'ton_buy_amt_5'  }],
        [{ text: '10 TON', callback_data: 'ton_buy_amt_10' }, { text: '✏️ O\'zgartirish', callback_data: 'ton_buy_custom' }],
        [{ text: '⬅️ Orqaga', callback_data: 'main' }],
      ]}}
    );
  });

  bot.action(/^ton_buy_amt_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const amount = parseInt(ctx.match[1], 10);
    await showTonBuyConfirm(ctx, amount, ST);
  });

  bot.action('ton_buy_custom', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'ton_buy_amount';
    await ctx.editMessageText('💰 Nechta TON sotib olmoqchisiz?', {
      reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }
    });
  });

  bot.action('ton_buy_confirm', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const st     = ST[userId] || {};
    const amount = st.tonBuyAmt;
    if (!amount) return ctx.editMessageText('❌ Xato. Qayta urinib ko\'ring.', mainKb.back());
    await processTonBuy(ctx, userId, amount, bot, ST);
  });

  // ── SELL TON ───────────────────────────────────────────────────
  bot.action('mkt_sell_ton', async ctx => {
    await ctx.answerCbQuery();
    const base  = sqlite.getSettingNum('ton_sell_base_price', 19000);
    const pct   = sqlite.getSettingNum('ton_sell_pct', 5);
    const price = Math.round(base * (1 - pct / 100));
    const wallet = sqlite.getSetting('ton_wallet') || 'Sozlanmagan';
    await ctx.editMessageText(
      `💸 <b>TON sotish</b>\n\n📊 Siz olasiz: <b>${fUzs(price)}</b> / 1 TON\n(Baza: ${fUzs(base)} - ${pct}%)\n\n🏦 TON yuboring:\n<code>${wallet}</code>\n\nNechta TON yuboryapsiz?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '1 TON',  callback_data: 'ton_sell_amt_1'  }, { text: '5 TON',  callback_data: 'ton_sell_amt_5'  }],
        [{ text: '10 TON', callback_data: 'ton_sell_amt_10' }, { text: '✏️ O\'zgartirish', callback_data: 'ton_sell_custom' }],
        [{ text: '⬅️ Orqaga', callback_data: 'main' }],
      ]}}
    );
  });

  bot.action(/^ton_sell_amt_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const amount = parseInt(ctx.match[1], 10);
    if (!ST[userId]) ST[userId] = {};
    ST[userId].tonSellAmt = amount;
    ST[userId].step       = 'ton_sell_proof';
    const base  = sqlite.getSettingNum('ton_sell_base_price', 19000);
    const pct   = sqlite.getSettingNum('ton_sell_pct', 5);
    const price = Math.round(base * (1 - pct / 100));
    await ctx.editMessageText(
      `💸 <b>TON sotish — ${amount} TON</b>\n\nSiz olasiz: <b>${fUzs(amount * price)}</b>\n\n📸 TON yuborgan chekingizni yuboring (screenshot):`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
    );
  });

  bot.action('ton_sell_custom', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'ton_sell_amount';
    await ctx.editMessageText('💸 Nechta TON sotyapsiz?', {
      reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }
    });
  });
}

async function showTonBuyConfirm(ctx, amount, ST) {
  const userId = ctx.from.id;
  const base   = sqlite.getSettingNum('ton_buy_base_price', 19000);
  const pct    = sqlite.getSettingNum('ton_buy_pct', 10);
  const price  = Math.round(base * (1 + pct / 100));
  const total  = amount * price;
  if (!ST[userId]) ST[userId] = {};
  ST[userId].tonBuyAmt = amount;
  await ctx.editMessageText(
    `💰 <b>TON sotib olish — Tasdiqlash</b>\n\n📦 Miqdor: <b>${amount} TON</b>\n💰 Narx: <b>${fUzs(total)}</b>\n\nTo'lov UZS hisobingizdan yechiladi.`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🟩 Tasdiqlash', callback_data: 'ton_buy_confirm' }],
      [{ text: '🟥 Bekor',      callback_data: 'mkt_buy_ton'     }],
    ]}}
  );
}

async function processTonBuy(ctx, userId, amount, bot, ST) {
  const base   = sqlite.getSettingNum('ton_buy_base_price', 19000);
  const pct    = sqlite.getSettingNum('ton_buy_pct', 10);
  const price  = Math.round(base * (1 + pct / 100));
  const total  = amount * price;
  const uzsBalance = await jdb.getUzs(userId);
  if (uzsBalance < total) {
    return ctx.editMessageText(`❌ UZS yetarli emas!\n\n💰 Kerak: ${fUzs(total)}\n💵 Sizda: ${fUzs(uzsBalance)}`, mainKb.back('mkt_buy_ton'));
  }
  await jdb.deductUzs(userId, total);
  const orderId = sqlite.createOrder({ userId, type: 'ton_buy', amount, price: total, status: 'pending', meta: { pricePerTon: price } });
  const user = await jdb.getUser(userId);
  await ctx.editMessageText(
    `✅ <b>TON buyurtma qabul qilindi!</b>\n\n📋 ID: <code>${orderId}</code>\n💰 ${amount} TON\n💵 ${fUzs(total)} to'landi\n\n⏳ Admin tasdiqlaydi.`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  try {
    await bot.telegram.sendMessage(cfg.ADMIN_ID,
      `💰 <b>TON Buy buyurtma</b>\n\n📋 <code>${orderId}</code>\n👤 ${user?.username || userId}\n💰 ${amount} TON\n💵 ${fUzs(total)}\n\nAdmin TON yuborsin!`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🟩 Tasdiqlash', callback_data: `adm_order_approve_${orderId}` }, { text: '🟥 Rad', callback_data: `adm_order_reject_${orderId}` }],
      ]}}
    );
  } catch {}
  if (ST[userId]) delete ST[userId].tonBuyAmt;
}

async function processTonSell(ctx, userId, amount, proofFileId, bot, ST) {
  const base   = sqlite.getSettingNum('ton_sell_base_price', 19000);
  const pct    = sqlite.getSettingNum('ton_sell_pct', 5);
  const price  = Math.round(base * (1 - pct / 100));
  const total  = amount * price;
  const orderId = sqlite.createOrder({ userId, type: 'ton_sell', amount, price: total, status: 'pending', proof: proofFileId, meta: { pricePerTon: price } });
  const user   = await jdb.getUser(userId);
  await ctx.reply(
    `✅ <b>TON sotish buyurtma!</b>\n\n📋 ID: <code>${orderId}</code>\n💸 ${amount} TON\n💵 Siz olasiz: ${fUzs(total)}\n\n⏳ Admin tasdiqlaydi.`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  try {
    await bot.telegram.sendMessage(cfg.ADMIN_ID,
      `💸 <b>TON Sell buyurtma</b>\n\n📋 <code>${orderId}</code>\n👤 ${user?.username || userId}\n💸 ${amount} TON\n💵 To'lanishi kerak: ${fUzs(total)}`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🟩 Tasdiqlash', callback_data: `adm_order_approve_${orderId}` }, { text: '🟥 Rad', callback_data: `adm_order_reject_${orderId}` }],
      ]}}
    );
    if (proofFileId) await bot.telegram.sendPhoto(cfg.ADMIN_ID, proofFileId, { caption: `TON Sell chek: ${orderId}` });
  } catch {}
  if (ST[userId]) { delete ST[userId].tonSellAmt; delete ST[userId].step; }
}

module.exports = { registerTonHandlers, showTonBuyConfirm, processTonBuy, processTonSell };
