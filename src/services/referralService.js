'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const logger = require('../utils/logger');

async function setReferrer(userId, refId) {
  if (Number(userId) === Number(refId)) return;
  const u = await jdb.getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(userId));
  if (i === -1 || u[i].invitedBy) return;
  u[i].invitedBy = Number(refId);
  await jdb.saveUsers(u);
}

async function grantStartBonus(userId, bot) {
  const u = await jdb.getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(userId));
  if (i === -1 || !u[i].invitedBy || u[i].referralRewarded) return false;

  const bonus     = sqlite.getSettingNum('referral_start_bonus', 1);
  const lockDays  = sqlite.getSettingNum('referral_lock_days', 7);
  const inviterId = u[i].invitedBy;

  u[i].referralRewarded = true;
  await jdb.saveUsers(u);

  // Lock the bonus for lockDays
  const lockedUntil = new Date(Date.now() + lockDays * 864e5).toISOString();
  await jdb.addLockedStars(inviterId, bonus);

  sqlite.addReferralEntry({
    inviterId, inviteeId: Number(userId),
    type: 'start_bonus', amount: bonus,
    locked: true, lockedUntil,
  });

  try {
    await bot.telegram.sendMessage(inviterId,
      `🔒 <b>Referral bonus qulflandi!</b>\n\n` +
      `👤 Do'stingiz botga qo'shildi.\n` +
      `⭐ <b>+${bonus} Stars</b> — ${lockDays} kundan so'ng qulfdan chiqadi.\n\n` +
      `Do'stingiz faol bo'lib, xarid qilsa, darhol komisyon olasiz!`,
      { parse_mode: 'HTML' }
    );
  } catch {}

  logger.info(`Referral start bonus locked: inviter=${inviterId}, invitee=${userId}, amount=${bonus}`);
  return true;
}

async function grantPurchaseCommission(inviteeId, purchaseType, purchaseAmountStars, bot) {
  const user = await jdb.getUser(inviteeId);
  if (!user?.invitedBy) return;

  const pctKey = {
    stars_buy:   'referral_stars_pct',
    gift_buy:    'referral_gift_pct',
    premium_buy: 'referral_premium_pct',
    ton_buy:     'referral_ton_pct',
  }[purchaseType];
  if (!pctKey) return;

  const pct        = sqlite.getSettingNum(pctKey, 0);
  if (pct <= 0) return;

  const commission = Math.floor(purchaseAmountStars * pct / 100);
  if (commission <= 0) return;

  const inviterId = user.invitedBy;
  await jdb.addStars(inviterId, commission);

  sqlite.addReferralEntry({
    inviterId, inviteeId: Number(inviteeId),
    type: purchaseType + '_commission', amount: commission,
    locked: false,
  });

  try {
    await bot.telegram.sendMessage(inviterId,
      `💰 <b>Referral komisyon!</b>\n\n` +
      `👤 Do'stingiz xarid qildi.\n` +
      `⭐ <b>+${commission} Stars</b> hisobingizga qo'shildi.`,
      { parse_mode: 'HTML' }
    );
  } catch {}

  logger.info(`Referral commission: inviter=${inviterId}, invitee=${inviteeId}, type=${purchaseType}, amount=${commission}`);
}

async function unlockExpiredRewards(bot) {
  const entries = sqlite.getLockedRewardsReadyToUnlock();
  for (const entry of entries) {
    try {
      const unlocked = await jdb.unlockStars(entry.inviterId, entry.amount);
      if (unlocked > 0) {
        sqlite.unlockReferralEntry(entry.id);
        try {
          await bot.telegram.sendMessage(entry.inviterId,
            `🔓 <b>Referral bonus qulfdan chiqdi!</b>\n\n⭐ <b>+${unlocked} Stars</b> endi foydalanishingiz mumkin!`,
            { parse_mode: 'HTML' }
          );
        } catch {}
        logger.info(`Referral unlocked: inviter=${entry.inviterId}, amount=${unlocked}`);
      }
    } catch (e) {
      logger.error('unlockExpiredRewards error', { id: entry.id, error: e.message });
    }
  }
}

async function applyStartReferral(userId, inviterId) {
  await setReferrer(userId, inviterId);
  // grantStartBonus needs bot, defer to cron — just set the referrer now
  // The cron will check referralRewarded on next run
}

module.exports = { setReferrer, grantStartBonus, grantPurchaseCommission, unlockExpiredRewards, applyStartReferral };
