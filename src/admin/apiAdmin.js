'use strict';
const sqlite = require('../database/sqlite');

function registerApiAdmin(bot, ST) {
  bot.action('adm_api', async ctx => {
    await ctx.answerCbQuery();
    await showApiSettings(ctx);
  });

  const steps = {
    adm_api_set_key:  { key: 'api_key',       label: '🔑 API kalitini kiriting:' },
    adm_api_set_url:  { key: 'api_base_url',  label: '🌐 API Base URL kiriting:' },
    adm_api_set_frag: { key: 'fragment_url',  label: '🌐 Fragment API URL kiriting:' },
  };

  for (const [action, conf] of Object.entries(steps)) {
    bot.action(action, async ctx => {
      await ctx.answerCbQuery();
      const adminId = ctx.from.id;
      if (!ST[adminId]) ST[adminId] = {};
      ST[adminId].step = action;
      await ctx.editMessageText(conf.label, {
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_api' }]] }
      });
    });
  }

  bot.action('adm_api_toggle_test', async ctx => {
    await ctx.answerCbQuery();
    const cur = sqlite.getSettingBool('api_test_mode', false);
    sqlite.setSetting('api_test_mode', cur ? '0' : '1');
    await showApiSettings(ctx);
  });
}

async function showApiSettings(ctx) {
  const key     = sqlite.getSetting('api_key') ? '✅ Sozlangan' : '❌ Sozlanmagan';
  const url     = sqlite.getSetting('api_base_url') || '❌ Sozlanmagan';
  const frag    = sqlite.getSetting('fragment_url') || '❌ Sozlanmagan';
  const testMode= sqlite.getSettingBool('api_test_mode', false);
  await ctx.editMessageText(
    `🔌 <b>API sozlamalari</b>\n\n🔑 API Key: ${key}\n🌐 Base URL: <code>${url}</code>\n🌐 Fragment: <code>${frag}</code>\n🧪 Test mode: ${testMode ? 'Yoqilgan' : 'O\'chirilgan'}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🔑 API Key',        callback_data: 'adm_api_set_key'  }],
      [{ text: '🌐 Base URL',        callback_data: 'adm_api_set_url'  }],
      [{ text: '🌐 Fragment URL',    callback_data: 'adm_api_set_frag' }],
      [{ text: `${testMode ? '🔴 Test mode o\'chirish' : '🟢 Test mode yoqish'}`, callback_data: 'adm_api_toggle_test' }],
      [{ text: '⬅️ Admin',           callback_data: 'adm_panel' }],
    ]}}
  );
}

async function handleApiAdminStep(ctx, adminId, text, ST) {
  const step = ST[adminId]?.step || '';
  const conf = {
    adm_api_set_key:  'api_key',
    adm_api_set_url:  'api_base_url',
    adm_api_set_frag: 'fragment_url',
  }[step];
  if (!conf) return false;
  sqlite.setSetting(conf, text.trim());
  delete ST[adminId].step;
  await ctx.reply('✅ Saqlandi.');
  return true;
}

module.exports = { registerApiAdmin, handleApiAdminStep };
