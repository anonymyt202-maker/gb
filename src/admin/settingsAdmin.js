'use strict';
const sqlite = require('../database/sqlite');
const cfg    = require('../config');

function registerSettingsAdmin(bot, ST) {
  bot.action('adm_settings', async ctx => {
    await ctx.answerCbQuery();
    await showSettings(ctx);
  });

  const toggles = ['maintenance_mode','ai_enabled','star_buy_enabled','star_sell_enabled','ton_enabled','registration_open'];
  for (const key of toggles) {
    bot.action(`adm_tog_${key}`, async ctx => {
      await ctx.answerCbQuery();
      const cur = sqlite.getSettingBool(key, false);
      sqlite.setSetting(key, cur ? '0' : '1');
      await showSettings(ctx);
    });
  }

  const textSteps = {
    adm_set_card:      { key: 'card_number',     label: '💳 Yangi karta raqamini kiriting:' },
    adm_set_welcome:   { key: 'welcome_text',    label: '👋 Yangi salomlashish matnini kiriting:' },
    adm_set_rules:     { key: 'rules_text',      label: '📜 Yangi qoidalar matnini kiriting:' },
    adm_set_min_uzs:   { key: 'min_uzs_deposit', label: '💵 Minimum UZS depozitni kiriting:' },
    adm_set_max_uzs:   { key: 'max_uzs_deposit', label: '💵 Maximum UZS depozitni kiriting:' },
  };

  for (const [action, conf] of Object.entries(textSteps)) {
    bot.action(action, async ctx => {
      await ctx.answerCbQuery();
      const adminId = ctx.from.id;
      if (!ST[adminId]) ST[adminId] = {};
      ST[adminId].step = action;
      await ctx.editMessageText(conf.label, {
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_settings' }]] }
      });
    });
  }
}

async function handleSettingsAdminStep(ctx, adminId, text, ST) {
  const step = ST[adminId]?.step || '';
  const textStepKeys = {
    adm_set_card:    'card_number',
    adm_set_welcome: 'welcome_text',
    adm_set_rules:   'rules_text',
    adm_set_min_uzs: 'min_uzs_deposit',
    adm_set_max_uzs: 'max_uzs_deposit',
  };
  const key = textStepKeys[step];
  if (!key) return false;
  sqlite.setSetting(key, text.trim());
  delete ST[adminId].step;
  await ctx.reply('✅ Saqlandi.');
  return true;
}

async function showSettings(ctx) {
  const maintenance = sqlite.getSettingBool('maintenance_mode', false);
  const ai          = sqlite.getSettingBool('ai_enabled', false);
  const regOpen     = sqlite.getSettingBool('registration_open', true);
  const card        = sqlite.getSetting('card_number') || cfg.CARD_NUMBER;
  const minUzs      = sqlite.getSettingNum('min_uzs_deposit', 10000);
  const maxUzs      = sqlite.getSettingNum('max_uzs_deposit', 10000000);
  await ctx.editMessageText(
    `⚙️ <b>Umumiy sozlamalar</b>\n\n🔧 Texnik ish: ${maintenance ? '🟢 Yoq' : '🔴 Yo\'q'}\n🤖 AI: ${ai ? '🟢' : '🔴'}\n📝 Ro\'yxatdan o\'tish: ${regOpen ? '🟢' : '🔴'}\n💳 Karta: <code>${card}</code>\n💵 UZS min/max: ${minUzs}/${maxUzs}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `${maintenance ? '🔴 Texnik ish o\'chirish' : '🟢 Texnik ish yoqish'}`, callback_data: 'adm_tog_maintenance_mode' }],
      [{ text: `${ai ? '🔴 AI o\'chirish' : '🟢 AI yoqish'}`,                         callback_data: 'adm_tog_ai_enabled'       }],
      [{ text: `${regOpen ? '🔴 Ro\'yxatni yopish' : '🟢 Ro\'yxatni ochish'}`,        callback_data: 'adm_tog_registration_open'}],
      [{ text: '💳 Karta o\'zgartirish',   callback_data: 'adm_set_card'    }],
      [{ text: '💵 Min/Max UZS depozit',  callback_data: 'adm_set_min_uzs' }],
      [{ text: '👋 Salomlashish matni',    callback_data: 'adm_set_welcome' }],
      [{ text: '📜 Qoidalar matni',        callback_data: 'adm_set_rules'   }],
      [{ text: '⬅️ Admin',                callback_data: 'adm_panel'        }],
    ]}}
  );
}

module.exports = { registerSettingsAdmin, handleSettingsAdminStep };
