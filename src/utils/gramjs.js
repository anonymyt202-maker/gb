'use strict';
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const { Api }            = require('telegram');
const cfg                = require('../config');
const { sessionLoad, sessionSave } = require('../database/json');
const logger             = require('./logger');

let tgClient    = null;
let tgConnected = false;

async function tgInit(str = '') {
  try {
    tgClient = new TelegramClient(new StringSession(str), cfg.API_ID, cfg.API_HASH,
      { connectionRetries: 5, useWSS: false });
    await tgClient.connect();
    if (await tgClient.isUserAuthorized()) {
      tgConnected = true;
      await sessionSave(tgClient.session.save());
      const me = await tgClient.getMe();
      logger.info(`TG hisob ulandi: @${me.username}`);
      return true;
    }
  } catch (e) {
    logger.error('tgInit error', { message: e.message });
  }
  tgConnected = false;
  return false;
}

async function tgConnect() {
  const saved = await sessionLoad();
  if (saved) {
    logger.info('Sessiya topildi, ulanmoqda...');
    return tgInit(saved);
  }
  return false;
}

function isTgConnected() { return tgConnected; }
function getTgClient()   { return tgClient; }

async function sendGiftGramJS(toUserId, tgGiftId, anonymous = false, message = null, senderInfo = null, notifyAdmin = null) {
  if (!tgClient || !tgConnected) return { ok: false, error: 'TG hisob ulanmagan' };
  try {
    let peer;
    try {
      peer = await tgClient.getInputEntity(Number(toUserId));
    } catch {
      if (senderInfo && notifyAdmin) {
        try {
          await notifyAdmin(
            `⚠️ <b>Gift Spam Ogohlantirish</b>\n\nFoydalanuvchi: ${toUserId}\nGift: ${tgGiftId}\nYuboruvchi: @${senderInfo.username} (<code>${senderInfo.userId}</code>)\n\nBotda chat ochmagan yoki spam account.`
          );
        } catch {}
      }
      return { ok: false, error: 'spam_account' };
    }

    let msgObj = null;
    if (message && message.trim()) {
      msgObj = new Api.TextWithEntities({ text: message.trim(), entities: [] });
    }

    const invoice = new Api.InputInvoiceStarGift({
      peer,
      giftId        : BigInt(String(tgGiftId)),
      hideName      : anonymous,
      includeUpgrade: false,
      message       : msgObj,
    });

    const form = await tgClient.invoke(new Api.payments.GetPaymentForm({ invoice }));
    await tgClient.invoke(new Api.payments.SendStarsForm({ formId: form.formId, invoice }));
    logger.info(`Gift yuborildi: giftId=${tgGiftId} → userId=${toUserId}`);
    return { ok: true, error: null };
  } catch (e) {
    logger.error('sendGiftGramJS error', { message: e.message });
    if (e.message.includes('USER_NOT_FOUND') || e.message.includes('PEER_ID_INVALID') || e.message.includes('USER_PRIVACY')) {
      return { ok: false, error: 'spam_account' };
    }
    if (e.message.includes('BALANCE_TOO_LOW')) {
      return { ok: false, error: 'balance_too_low' };
    }
    return { ok: false, error: e.message };
  }
}

async function computeSrp(pwdInfo, password) {
  const { computeCheck } = require('telegram/Password');
  return computeCheck(pwdInfo, password);
}

// Start TG login flow (phone number step)
async function startTgLogin(phone) {
  try {
    tgClient = new TelegramClient(new StringSession(''), cfg.API_ID, cfg.API_HASH, { connectionRetries: 5 });
    await tgClient.connect();
    const result = await tgClient.sendCode({ apiId: cfg.API_ID, apiHash: cfg.API_HASH }, phone);
    return { ok: true, phoneCodeHash: result.phoneCodeHash };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Verify phone code
async function verifyTgCode(phone, phoneCodeHash, code) {
  try {
    await tgClient.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }));
    tgConnected = true;
    await sessionSave(tgClient.session.save());
    const me = await tgClient.getMe();
    return { ok: true, username: me.username, needs2fa: false };
  } catch (e) {
    if (e.message.includes('SESSION_PASSWORD_NEEDED')) {
      return { ok: false, needs2fa: true };
    }
    return { ok: false, error: e.message, needs2fa: false };
  }
}

// Verify 2FA password
async function verifyTg2FA(password) {
  try {
    const pwdInfo = await tgClient.invoke(new Api.account.GetPassword());
    await tgClient.invoke(new Api.auth.CheckPassword({ password: await computeSrp(pwdInfo, password) }));
    tgConnected = true;
    await sessionSave(tgClient.session.save());
    const me = await tgClient.getMe();
    return { ok: true, username: me.username };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function disconnectTg() {
  try { if (tgClient) await tgClient.disconnect(); } catch {}
  tgConnected = false;
  tgClient = null;
}

module.exports = {
  tgInit, tgConnect, isTgConnected, getTgClient,
  sendGiftGramJS, computeSrp,
  startTgLogin, verifyTgCode, verifyTg2FA, disconnectTg,
};
