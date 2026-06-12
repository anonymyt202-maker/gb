/**
 * giftSender.js
 * Telegram Bot API orqali gift yuborish.
 * Telethon (Python) ning Node.js muqobili.
 * sendGift metodi Bot API "sendGift" metodini ishlatadi.
 */

const fetch = require('node-fetch');
const cfg = require('./config');

// ─── In-memory login sessions (Telethon replacement) ──────────────
// Note: To'liq MTProto uchun alohida server yoki Python microservice kerak.
// Bot API sendGift endpoint orqali ishlaydigan yechim:

async function sendGiftViaBotApi(toUserId, tgGiftId, anonymous = false, message = '') {
  /**
   * Telegram Bot API ga gift yuborish so'rovi.
   * sendGift metodi Telegram Bot API da mavjud (2024+).
   */
  const url = `https://api.telegram.org/bot${cfg.BOT_TOKEN}/sendGift`;
  try {
    const body = {
      user_id: toUserId,
      gift_id: String(tgGiftId),
      hide_my_name: anonymous,
    };
    if (message && message.trim()) {
      body.text = message.trim().substring(0, 255);
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 30000,
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true };
    }
    // Xato turini aniqlash
    const errDesc = data.description || '';
    let errType = 'unknown';
    if (errDesc.includes('USER_NOT_PARTICIPANT') || errDesc.includes('chat not found') || errDesc.includes('blocked')) {
      errType = 'user_not_started';
    } else if (errDesc.includes('balance') || errDesc.includes('STARS')) {
      errType = 'balance_low';
    } else if (errDesc.includes('FLOOD') || errDesc.includes('Too Many Requests')) {
      errType = 'flood';
    } else if (errDesc.includes('GIFT_SOLD_OUT')) {
      errType = 'sold_out';
    }
    return { ok: false, error: errDesc, errorType: errType };
  } catch (e) {
    return { ok: false, error: e.message, errorType: 'network' };
  }
}

// ─── Telethon session orqali yuborish (session_string mavjud bo'lsa) ──
async function sendGiftViaSession(sessionString, toUserId, tgGiftId, anonymous = false, message = '') {
  /**
   * Agar session_string mavjud bo'lsa, Python microservice orqali yuborish.
   * Yoki Bot API ga fallback.
   * 
   * Production uchun: alohida Python worker yoki Node.js MTProto lib ishlatiladi.
   * Hozircha Bot API ga fallback qilamiz.
   */
  return sendGiftViaBotApi(toUserId, tgGiftId, anonymous, message);
}

async function sendGift({ sessionString, toUserId, tgGiftId, anonymous = false, message = '' }) {
  if (sessionString) {
    return sendGiftViaSession(sessionString, toUserId, tgGiftId, anonymous, message);
  }
  return sendGiftViaBotApi(toUserId, tgGiftId, anonymous, message);
}

// ─── Session info ─────────────────────────────────────────────────
async function getSessionInfo(sessionString) {
  // Bot API orqali bot o'zini tekshirish
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.BOT_TOKEN}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, username: data.result.username, first_name: data.result.first_name, tg_id: data.result.id };
    }
    return { ok: false, error: 'Bot API xato' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendGift, getSessionInfo };
