'use strict';
const sqlite = require('../database/sqlite');
const { fUzs } = require('../utils/format');

function registerTonAdmin(bot, ST) {
  bot.action('adm_ton', async ctx => {
    await ctx.answerCbQuery();
    await showTonSettings(ctx);
  });

  const steps = ['adm_ton_buy_base','adm_ton_buy_pct','adm_ton_sell_base','adm_ton_sell_pct','adm_ton_wallet'];
  const btnMap = {
    adm_ton_buy_base:  'ton_buy_base_price',
    adm_ton_buy_pct:   'ton_buy_pct',
    adm_ton_sell_base: 'ton_sell_base_price',
    adm_ton_sell_pct:  'ton_sell_pct',
  };
  for (const s of steps) {
    bot.action(s, async ctx => {
      await ctx.answerCbQuery();
      const adminId = ctx.from.id;
      if (!ST[adminId]) ST[adminId] = {};
      ST[adminId].step = s;
      const prompts = {
        adm_ton_buy_base:  '💰 TON buy baza narxini UZS da kiriting:',
        adm_ton_buy_pct:   '📈 TON buy foizini kiriting (masalan: 10):',
        adm_ton_sell_base: '💸 TON sell baza narxini UZS da kiriting:',
        adm_ton_sell_pct:  '📉 TON sell foizini kiriting (masalan: 5):',
        adm_ton_wallet:    '🏦 TON hamyon manzilini kiriting:',
      };
      await ctx.editMessageText(prompts[s] || 'Kiriting:', {
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_ton' }]] }
      });
    });
  }
}

async function showTonSettings(ctx) {
  const buyBase  = sqlite.getSettingNum('ton_buy_base_price', 19000);
  const buyPct   = sqlite.getSettingNum('ton_buy_pct', 10);
  const sellBase = sqlite.getSettingNum('ton_sell_base_price', 19000);
  const sellPct  = sqlite.getSettingNum('ton_sell_pct', 5);
  const wallet   = sqlite.getSetting('ton_wallet') || 'Sozlanmagan';
  const buyPrice  = Math.round(buyBase * (1 + buyPct / 100));
  const sellPrice = Math.round(sellBase * (1 - sellPct / 100));
  await ctx.editMessageText(
    `💰 <b>TON sozlamalari</b>\n\n<b>BUY:</b>\nBaza: ${fUzs(buyBase)} + ${buyPct}% = <b>${fUzs(buyPrice)}</b>\n\n<b>SELL:</b>\nBaza: ${fUzs(sellBase)} - ${sellPct}% = <b>${fUzs(sellPrice)}</b>\n\n🏦 Hamyon: <code>${wallet}</code>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '💰 Buy baza narxi', callback_data: 'adm_ton_buy_base' }, { text: '📈 Buy foiz',  callback_data: 'adm_ton_buy_pct'  }],
      [{ text: '💸 Sell baza narxi',callback_data: 'adm_ton_sell_base'}, { text: '📉 Sell foiz', callback_data: 'adm_ton_sell_pct' }],
      [{ text: '🏦 TON Hamyon',     callback_data: 'adm_ton_wallet' }],
      [{ text: '⬅️ Admin',          callback_data: 'adm_panel' }],
    ]}}
  );
}

async function handleTonAdminStep(ctx, adminId, text, ST) {
  const step = ST[adminId]?.step || '';
  const keyMap = {
    adm_ton_buy_base:  { key: 'ton_buy_base_price',  num: true  },
    adm_ton_buy_pct:   { key: 'ton_buy_pct',          num: true  },
    adm_ton_sell_base: { key: 'ton_sell_base_price',  num: true  },
    adm_ton_sell_pct:  { key: 'ton_sell_pct',         num: true  },
    adm_ton_wallet:    { key: 'ton_wallet',            num: false },
  };
  const conf = keyMap[step];
  if (!conf) return false;
  if (conf.num) {
    const n = parseFloat(text);
    if (isNaN(n) || n < 0) return ctx.reply('❌ To\'g\'ri raqam kiriting:');
    sqlite.setSetting(conf.key, String(n));
  } else {
    sqlite.setSetting(conf.key, text.trim());
  }
  delete ST[adminId].step;
  await ctx.reply(`✅ Saqlandi.`);
  return true;
}

module.exports = { registerTonAdmin, handleTonAdminStep };
