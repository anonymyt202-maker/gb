'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const { fUzs } = require('../utils/format');

function registerReferralAdmin(bot, ST) {
  bot.action('adm_referral', async ctx => {
    await ctx.answerCbQuery();
    await showReferralSettings(ctx);
  });

  const refSteps = {
    adm_ref_start_bonus:    { key: 'referral_start_bonus',  label: '🎁 /start referral bonusini ⭐ da kiriting:'   },
    adm_ref_lock_days:      { key: 'referral_lock_days',    label: '🔒 Qulflanish kunlarini kiriting:'               },
    adm_ref_stars_pct:      { key: 'referral_stars_pct',    label: '⭐ Stars referral foizini kiriting (0-100):'     },
    adm_ref_gift_pct:       { key: 'referral_gift_pct',     label: '🎁 Gift referral foizini kiriting (0-100):'      },
    adm_ref_premium_pct:    { key: 'referral_premium_pct',  label: '💎 Premium referral foizini kiriting (0-100):'   },
    adm_ref_ton_pct:        { key: 'referral_ton_pct',      label: '💰 TON referral foizini kiriting (0-100):'       },
  };

  for (const [action, conf] of Object.entries(refSteps)) {
    bot.action(action, async ctx => {
      await ctx.answerCbQuery();
      const adminId = ctx.from.id;
      if (!ST[adminId]) ST[adminId] = {};
      ST[adminId].step = action;
      await ctx.editMessageText(conf.label, {
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_referral' }]] }
      });
    });
  }

  bot.action('adm_ref_top', async ctx => {
    await ctx.answerCbQuery();
    const top = sqlite.getTopInviters(10);
    if (!top.length) return ctx.editMessageText('📊 Ma\'lumot yo\'q.', require('../keyboards/adminKeyboard').back('adm_referral'));
    const lines = top.map((r, i) => `${i+1}. ID ${r.inviterId} — ${r.referrals} ta | ${r.earnings} ⭐`).join('\n');
    await ctx.editMessageText(`🏆 <b>Top Inviters</b>\n\n${lines}`, { parse_mode: 'HTML', ...require('../keyboards/adminKeyboard').back('adm_referral') });
  });
}

async function showReferralSettings(ctx) {
  const bonus     = sqlite.getSettingNum('referral_start_bonus', 1);
  const lockDays  = sqlite.getSettingNum('referral_lock_days', 7);
  const starsPct  = sqlite.getSettingNum('referral_stars_pct', 5);
  const giftPct   = sqlite.getSettingNum('referral_gift_pct', 2);
  const premPct   = sqlite.getSettingNum('referral_premium_pct', 3);
  const tonPct    = sqlite.getSettingNum('referral_ton_pct', 2);
  await ctx.editMessageText(
    `👥 <b>Referral sozlamalari</b>\n\n🎁 Start bonus: <b>${bonus} ⭐</b>\n🔒 Qulf muddati: <b>${lockDays} kun</b>\n\n💱 Komisyon foizlari:\n⭐ Stars: ${starsPct}%\n🎁 Gift: ${giftPct}%\n💎 Premium: ${premPct}%\n💰 TON: ${tonPct}%`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🎁 Start bonus', callback_data: 'adm_ref_start_bonus' }, { text: '🔒 Qulf kunlari', callback_data: 'adm_ref_lock_days' }],
      [{ text: '⭐ Stars %',     callback_data: 'adm_ref_stars_pct'   }, { text: '🎁 Gift %',        callback_data: 'adm_ref_gift_pct'   }],
      [{ text: '💎 Premium %',   callback_data: 'adm_ref_premium_pct' }, { text: '💰 TON %',          callback_data: 'adm_ref_ton_pct'    }],
      [{ text: '🏆 Top Inviters',callback_data: 'adm_ref_top'         }],
      [{ text: '⬅️ Admin',       callback_data: 'adm_panel'           }],
    ]}}
  );
}

async function handleReferralAdminStep(ctx, adminId, text, ST) {
  const step = ST[adminId]?.step || '';
  const refStepKeys = {
    adm_ref_start_bonus:  'referral_start_bonus',
    adm_ref_lock_days:    'referral_lock_days',
    adm_ref_stars_pct:    'referral_stars_pct',
    adm_ref_gift_pct:     'referral_gift_pct',
    adm_ref_premium_pct:  'referral_premium_pct',
    adm_ref_ton_pct:      'referral_ton_pct',
  };
  const key = refStepKeys[step];
  if (!key) return false;
  const n = parseFloat(text);
  if (isNaN(n) || n < 0) return ctx.reply('❌ To\'g\'ri raqam kiriting:');
  sqlite.setSetting(key, String(n));
  delete ST[adminId].step;
  await ctx.reply(`✅ Saqlandi: ${n}`);
  return true;
}

module.exports = { registerReferralAdmin, handleReferralAdminStep };
