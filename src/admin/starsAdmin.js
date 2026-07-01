'use strict';
const sqlite = require('../database/sqlite');
const admKb  = require('../keyboards/adminKeyboard');
const { fUzs } = require('../utils/format');

function registerStarsAdmin(bot, ST) {
  bot.action('adm_stars', async ctx => {
    await ctx.answerCbQuery();
    await showStarsSettings(ctx);
  });

  bot.action('adm_stars_set_price', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'adm_stars_price';
    await ctx.editMessageText('⭐ 1 Stars narxini UZS da kiriting:', {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_stars' }]] }
    });
  });

  bot.action('adm_stars_set_min', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'adm_stars_min';
    await ctx.editMessageText('⭐ Minimum Stars miqdorini kiriting:', {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_stars' }]] }
    });
  });

  bot.action('adm_stars_toggle_buy', async ctx => {
    await ctx.answerCbQuery();
    const cur = sqlite.getSettingBool('star_buy_enabled', true);
    sqlite.setSetting('star_buy_enabled', cur ? '0' : '1');
    await showStarsSettings(ctx);
  });

  bot.action('adm_stars_toggle_sell', async ctx => {
    await ctx.answerCbQuery();
    const cur = sqlite.getSettingBool('star_sell_enabled', true);
    sqlite.setSetting('star_sell_enabled', cur ? '0' : '1');
    await showStarsSettings(ctx);
  });

  bot.action('adm_stars_set_sell_channel', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'adm_stars_sell_channel';
    await ctx.editMessageText('📢 Stars sotish kanal ID ni kiriting (@username yoki chat_id):', {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_stars' }]] }
    });
  });
}

async function showStarsSettings(ctx) {
  const price   = sqlite.getSettingNum('star_buy_price', 140);
  const min     = sqlite.getSettingNum('star_min_buy', 10);
  const buyOn   = sqlite.getSettingBool('star_buy_enabled', true);
  const sellOn  = sqlite.getSettingBool('star_sell_enabled', true);
  const sellCh  = sqlite.getSetting('stars_sell_channel') || 'Sozlanmagan';
  await ctx.editMessageText(
    `⭐ <b>Stars sozlamalari</b>\n\n💰 1 Star narxi: <b>${fUzs(price)}</b>\n📦 Minimum: <b>${min} Stars</b>\n🟢 Buy: ${buyOn ? 'Yoqilgan' : 'O\'chirilgan'}\n🟢 Sell: ${sellOn ? 'Yoqilgan' : 'O\'chirilgan'}\n📢 Sell kanali: ${sellCh}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '💰 Narx o\'zgartirish', callback_data: 'adm_stars_set_price' }],
      [{ text: '📦 Min miqdor', callback_data: 'adm_stars_set_min' }],
      [{ text: `${buyOn ? '🔴 Buy o\'chirish' : '🟢 Buy yoqish'}`, callback_data: 'adm_stars_toggle_buy' }],
      [{ text: `${sellOn ? '🔴 Sell o\'chirish' : '🟢 Sell yoqish'}`, callback_data: 'adm_stars_toggle_sell' }],
      [{ text: '📢 Sell kanal', callback_data: 'adm_stars_set_sell_channel' }],
      [{ text: '⬅️ Admin', callback_data: 'adm_panel' }],
    ]}}
  );
}

async function handleStarsAdminStep(ctx, adminId, text, ST) {
  if (ST[adminId]?.step === 'adm_stars_price') {
    const n = parseInt(text, 10);
    if (isNaN(n) || n <= 0) return ctx.reply('❌ To\'g\'ri raqam kiriting:');
    sqlite.setSetting('star_buy_price', String(n));
    delete ST[adminId].step;
    await ctx.reply(`✅ 1 Star narxi: ${fUzs(n)}`);
    return true;
  }
  if (ST[adminId]?.step === 'adm_stars_min') {
    const n = parseInt(text, 10);
    if (isNaN(n) || n <= 0) return ctx.reply('❌ To\'g\'ri raqam kiriting:');
    sqlite.setSetting('star_min_buy', String(n));
    delete ST[adminId].step;
    await ctx.reply(`✅ Minimum: ${n} Stars`);
    return true;
  }
  if (ST[adminId]?.step === 'adm_stars_sell_channel') {
    sqlite.setSetting('stars_sell_channel', text.trim());
    delete ST[adminId].step;
    await ctx.reply(`✅ Sell kanali: ${text.trim()}`);
    return true;
  }
  return false;
}

module.exports = { registerStarsAdmin, handleStarsAdminStep };
