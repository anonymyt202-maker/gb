'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const mainKb = require('../keyboards/mainKeyboard');
const { fUzs } = require('../utils/format');
const { sanitizeAmount } = require('../utils/validation');
const cfg    = require('../config');

function registerConversionHandlers(bot, ST) {
  bot.action('mkt_conv', async ctx => {
    await ctx.answerCbQuery();
    const enabled = sqlite.getSettingBool('conv_stars_uzs_enabled', true);
    if (!enabled) return ctx.editMessageText('🔄 Konversiya hozir o\'chirilgan.', mainKb.back());
    const rate = sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
    const min  = sqlite.getSettingNum('conv_min_stars', 1);
    const max  = sqlite.getSettingNum('conv_max_stars', 10000);
    const userId = ctx.from.id;
    const stars  = await jdb.getStars(userId);
    const uzs    = await jdb.getUzs(userId);
    await ctx.editMessageText(
      `🔄 <b>Stars → UZS</b>\n\n💱 1 ⭐ = ${fUzs(rate)}\n📦 Min: ${min} ⭐ | Max: ${max} ⭐\n\n💼 Sizda: ⭐ ${stars} Stars | 💵 ${fUzs(uzs)}\n\nNechta Stars konvert qilmoqchisiz?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '10 ⭐',  callback_data: 'conv_amt_10'  }, { text: '50 ⭐',  callback_data: 'conv_amt_50'  }],
        [{ text: '100 ⭐', callback_data: 'conv_amt_100' }, { text: '500 ⭐', callback_data: 'conv_amt_500' }],
        [{ text: '✏️ O\'zgartirish', callback_data: 'conv_custom' }],
        [{ text: '⬅️ Orqaga', callback_data: 'main' }],
      ]}}
    );
  });

  bot.action(/^conv_amt_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const amount = parseInt(ctx.match[1], 10);
    await showConvConfirm(ctx, amount, ST);
  });

  bot.action('conv_custom', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'conv_stars_uzs';
    await ctx.editMessageText('⭐ Nechta Stars konvert qilmoqchisiz?', {
      reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }
    });
  });

  bot.action('conv_confirm', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const st     = ST[userId] || {};
    const amount = st.convAmt;
    if (!amount) return ctx.editMessageText('❌ Xato. Qayta urinib ko\'ring.', mainKb.back('mkt_conv'));
    await processConversion(ctx, userId, amount, bot, ST);
  });

  // Legacy: UZS → Stars
  bot.action('conv_uzs_stars', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'conv_uzs_stars';
    const rate = sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
    const uzs  = await jdb.getUzs(userId);
    await ctx.editMessageText(
      `🔄 <b>UZS → Stars</b>\n\n💱 ${fUzs(rate)} = 1 ⭐\n💵 Sizda: ${fUzs(uzs)}\n\nNechta Stars olmoqchisiz?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
    );
  });
}

async function showConvConfirm(ctx, amount, ST) {
  const userId = ctx.from.id;
  const min    = sqlite.getSettingNum('conv_min_stars', 1);
  const max    = sqlite.getSettingNum('conv_max_stars', 10000);
  if (amount < min || amount > max) {
    return ctx.editMessageText(`❌ Min ${min} ⭐, Max ${max} ⭐ bo'lishi kerak.`, mainKb.back('mkt_conv'));
  }
  const rate = sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
  const uzs  = amount * rate;
  if (!ST[userId]) ST[userId] = {};
  ST[userId].convAmt = amount;
  await ctx.editMessageText(
    `🔄 <b>Konversiya tasdiqlash</b>\n\n⭐ <b>-${amount} Stars</b>\n💵 <b>+${fUzs(uzs)}</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🟩 Tasdiqlash', callback_data: 'conv_confirm' }],
      [{ text: '🟥 Bekor',      callback_data: 'mkt_conv'     }],
    ]}}
  );
}

async function processConversion(ctx, userId, amount, bot, ST) {
  const min  = sqlite.getSettingNum('conv_min_stars', 1);
  const max  = sqlite.getSettingNum('conv_max_stars', 10000);
  if (amount < min || amount > max) return ctx.editMessageText(`❌ Min ${min} ⭐, Max ${max} ⭐.`, mainKb.back('mkt_conv'));
  const rate  = sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
  const stars = await jdb.getStars(userId);
  if (stars < amount) return ctx.editMessageText(`❌ Stars yetarli emas! Sizda: ${stars} ⭐`, mainKb.back('mkt_conv'));
  await jdb.deductStars(userId, amount);
  const uzs = amount * rate;
  await jdb.addUzs(userId, uzs);
  sqlite.addConversionRecord(userId, amount, uzs, rate);
  sqlite.createOrder({ userId, type: 'conversion', amount, price: uzs, status: 'completed', meta: { rate } });
  const newStars = await jdb.getStars(userId);
  const newUzs   = await jdb.getUzs(userId);
  await ctx.editMessageText(
    `✅ <b>Konversiya muvaffaqiyatli!</b>\n\n⭐ -${amount} Stars\n💵 +${fUzs(uzs)}\n\n💼 Hisob: ⭐ ${newStars} | 💵 ${fUzs(newUzs)}`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  if (ST[userId]) delete ST[userId].convAmt;
}

async function processUzsToStars(ctx, userId, starsAmount, bot, ST) {
  const rate     = sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
  const uzsNeeded = starsAmount * rate;
  const uzsBal   = await jdb.getUzs(userId);
  if (uzsBal < uzsNeeded) {
    return ctx.reply(`❌ UZS yetarli emas! Kerak: ${fUzs(uzsNeeded)}, sizda: ${fUzs(uzsBal)}`);
  }
  await jdb.deductUzs(userId, uzsNeeded);
  await jdb.addStars(userId, starsAmount);
  const newStars = await jdb.getStars(userId);
  const newUzs   = await jdb.getUzs(userId);
  await ctx.reply(
    `✅ <b>Konversiya!</b>\n\n💵 -${fUzs(uzsNeeded)}\n⭐ +${starsAmount} Stars\n\n💼 ⭐ ${newStars} | 💵 ${fUzs(newUzs)}`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  if (ST[userId]) delete ST[userId].step;
}

module.exports = { registerConversionHandlers, showConvConfirm, processConversion, processUzsToStars };
