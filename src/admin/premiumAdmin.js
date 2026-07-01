'use strict';
const sqlite = require('../database/sqlite');
const admKb  = require('../keyboards/adminKeyboard');

function registerPremiumAdmin(bot, ST) {
  bot.action('adm_premium', async ctx => {
    await ctx.answerCbQuery();
    await showPremiumSettings(ctx);
  });

  const plans = [1, 3, 6, 12];
  for (const m of plans) {
    bot.action(`adm_prem_set_${m}`, async ctx => {
      await ctx.answerCbQuery();
      const adminId = ctx.from.id;
      if (!ST[adminId]) ST[adminId] = {};
      ST[adminId].step = `adm_prem_price_${m}`;
      await ctx.editMessageText(`💎 ${m} oylik Premium narxini ⭐ da kiriting:`, {
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_premium' }]] }
      });
    });
  }
}

async function showPremiumSettings(ctx) {
  const p1  = sqlite.getSettingNum('premium_1m_price',  500);
  const p3  = sqlite.getSettingNum('premium_3m_price',  1200);
  const p6  = sqlite.getSettingNum('premium_6m_price',  2200);
  const p12 = sqlite.getSettingNum('premium_12m_price', 4000);
  await ctx.editMessageText(
    `💎 <b>Premium sozlamalari</b>\n\n1 oy: <b>${p1} ⭐</b>\n3 oy: <b>${p3} ⭐</b>\n6 oy: <b>${p6} ⭐</b>\n12 oy: <b>${p12} ⭐</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '1 oy narxi',  callback_data: 'adm_prem_set_1'  }, { text: '3 oy narxi',  callback_data: 'adm_prem_set_3'  }],
      [{ text: '6 oy narxi',  callback_data: 'adm_prem_set_6'  }, { text: '12 oy narxi', callback_data: 'adm_prem_set_12' }],
      [{ text: '⬅️ Admin', callback_data: 'adm_panel' }],
    ]}}
  );
}

async function handlePremiumAdminStep(ctx, adminId, text, ST) {
  const step = ST[adminId]?.step || '';
  const match = step.match(/^adm_prem_price_(\d+)$/);
  if (match) {
    const months = match[1];
    const n = parseInt(text, 10);
    if (isNaN(n) || n <= 0) return ctx.reply('❌ To\'g\'ri raqam kiriting:');
    sqlite.setSetting(`premium_${months}m_price`, String(n));
    delete ST[adminId].step;
    await ctx.reply(`✅ ${months} oylik Premium narxi: ${n} ⭐`);
    return true;
  }
  return false;
}

module.exports = { registerPremiumAdmin, handlePremiumAdminStep };
