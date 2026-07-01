'use strict';
const jdb      = require('../database/json');
const sqlite   = require('../database/sqlite');
const gramjs   = require('../utils/gramjs');
const { fUzs, esc, tmeUrl } = require('../utils/format');
const mainKb   = require('../keyboards/mainKeyboard');
const refSvc   = require('../services/referralService');
const logger   = require('../utils/logger');
const cfg      = require('../config');

const STARS_TO_UZS = () => sqlite.getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);

function registerGiftHandlers(bot, ST) {

  // ── Gift shop list ────────────────────────────────────────────
  bot.action('buy_gift', async ctx => {
    await ctx.answerCbQuery();
    const gifts = await jdb.getGifts();
    if (!gifts.length) return ctx.editMessageText('🎁 Hozircha gift yo\'q.', mainKb.back());
    const rows = gifts.map(g => [{
      text: `🎁 ${g.name} — ${g.price} ⭐`,
      callback_data: `gift_select_${g.id}`,
    }]);
    rows.push([{ text: '⬅️ Orqaga', callback_data: 'main' }]);
    await ctx.editMessageText('🎁 <b>Gift do\'koni</b>\n\nBir giftni tanlang:', {
      parse_mode: 'HTML', reply_markup: { inline_keyboard: rows },
    });
  });

  // ── Select gift ───────────────────────────────────────────────
  bot.action(/^gift_select_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const giftId = ctx.match[1];
    const userId = ctx.from.id;
    const gifts  = await jdb.getGifts();
    const gift   = gifts.find(g => String(g.id) === giftId);
    if (!gift) return ctx.editMessageText('❌ Gift topilmadi!', mainKb.back());
    if (!ST[userId]) ST[userId] = {};
    ST[userId].selGift = gift;
    const stars = await jdb.getStars(userId);
    const uzs   = await jdb.getUzs(userId);
    const rate  = STARS_TO_UZS();
    await ctx.editMessageText(
      `🎁 <b>${esc(gift.name)}</b>\n\n💰 Narx: <b>${gift.price} ⭐</b> (${fUzs(gift.price * rate)})\n\n` +
      `💼 Hisobingiz:\n   ⭐ ${stars} Stars\n   💵 ${fUzs(uzs)}\n\nTo\'lov usulini tanlang:`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '⭐ Stars bilan',  callback_data: 'gift_pay_stars' }],
        [{ text: '💵 UZS bilan',    callback_data: 'gift_pay_uzs'   }],
        [{ text: '⬅️ Orqaga',       callback_data: 'buy_gift'       }],
      ]}}
    );
  });

  // ── Pay with stars ────────────────────────────────────────────
  bot.action('gift_pay_stars', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]?.selGift) return ctx.editMessageText('❌ Gift tanlanmagan.', mainKb.back());
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftPayWith = 'stars';
    await ctx.editMessageText('👤 Kimga yuboramiz?', { reply_markup: { inline_keyboard: [
      [{ text: '👤 O\'zimga',             callback_data: 'gift_to_self'   }],
      [{ text: '👥 Do\'stga (username)',   callback_data: 'gift_to_friend' }],
      [{ text: '🔗 Havola orqali',         callback_data: 'gift_to_link'   }],
      [{ text: '⬅️ Orqaga',               callback_data: `gift_select_${ST[userId].selGift.id}` }],
    ]}});
  });

  // ── Pay with UZS ─────────────────────────────────────────────
  bot.action('gift_pay_uzs', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]?.selGift) return ctx.editMessageText('❌ Gift tanlanmagan.', mainKb.back());
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftPayWith = 'uzs';
    await ctx.editMessageText('👤 Kimga yuboramiz?', { reply_markup: { inline_keyboard: [
      [{ text: '👤 O\'zimga',             callback_data: 'gift_to_self'   }],
      [{ text: '👥 Do\'stga (username)',   callback_data: 'gift_to_friend' }],
      [{ text: '🔗 Havola orqali',         callback_data: 'gift_to_link'   }],
      [{ text: '⬅️ Orqaga',               callback_data: `gift_select_${ST[userId]?.selGift?.id}` }],
    ]}});
  });

  // ── To self ────────────────────────────────────────────────────
  bot.action('gift_to_self', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftTarget = 'self';
    ST[userId].step = 'gift_message';
    ST[userId]._commentMode = 'self';
    await ctx.editMessageText('💬 Izoh qo\'shmoqchimisiz? (Yo\'q deb o\'tkazib yuborish uchun /skip yozing)', {
      reply_markup: { inline_keyboard: [[{ text: '⏭ O\'tkazib yuborish', callback_data: 'gift_skip_msg' }]] }
    });
  });

  // ── To friend ─────────────────────────────────────────────────
  bot.action('gift_to_friend', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftTarget = 'friend';
    ST[userId].step = 'friend_username';
    await ctx.editMessageText('👤 Do\'stingizning @username ni kiriting:',
      { reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'buy_gift' }]] }}
    );
  });

  // ── To link ───────────────────────────────────────────────────
  bot.action('gift_to_link', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftTarget = 'link';
    ST[userId].step = 'gift_message';
    ST[userId]._commentMode = 'link';
    await ctx.editMessageText('💬 Izoh qo\'shmoqchimisiz?', {
      reply_markup: { inline_keyboard: [[{ text: '⏭ O\'tkazib yuborish', callback_data: 'gift_skip_msg' }]] }
    });
  });

  // ── Skip message ──────────────────────────────────────────────
  bot.action('gift_skip_msg', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].message = null;
    delete ST[userId].step;
    await askAnonMode(ctx, userId, ST);
  });

  // ── Anonymous toggle ──────────────────────────────────────────
  bot.action('gift_anon_yes', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftAnon = true;
    await showGiftConfirm(ctx, userId, ST, bot);
  });
  bot.action('gift_anon_no', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].giftAnon = false;
    await showGiftConfirm(ctx, userId, ST, bot);
  });

  // ── Confirm gift ──────────────────────────────────────────────
  bot.action('gconfirm_yes', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const st     = ST[userId] || {};
    const gift   = st.selGift;
    if (!gift) return ctx.reply('❌ Xato. Qayta urinib ko\'ring.', mainKb.back());
    await processGiftPurchase(ctx, gift, st, userId, bot, ST);
  });

  bot.action('gconfirm_no', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (ST[userId]) { delete ST[userId].selGift; delete ST[userId].pendingGift; }
    await ctx.editMessageText('❌ Bekor qilindi.', mainKb.back());
  });
}

async function askAnonMode(ctx, userId, ST) {
  await ctx.editMessageText('🕵️ Gift anonim yuboriladimi?', {
    reply_markup: { inline_keyboard: [
      [{ text: '✅ Ha, anonim', callback_data: 'gift_anon_yes' }, { text: '❌ Yo\'q', callback_data: 'gift_anon_no' }],
    ]},
  });
}

async function showGiftConfirm(ctx, userId, ST, bot) {
  const st   = ST[userId] || {};
  const gift = st.selGift;
  if (!gift) return ctx.editMessageText('❌ Gift tanlanmagan.', require('../keyboards/mainKeyboard').back());
  const rate     = require('../database/sqlite').getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
  const payWith  = st.giftPayWith || 'stars';
  const payDesc  = payWith === 'stars' ? `⭐ ${gift.price} Stars` : `💵 ${fUzs(gift.price * rate)}`;
  const target   = st.giftTarget;
  const toDesc   = target === 'self' ? '👤 O\'zingizga' : target === 'friend' ? `👥 @${st.friendUsername || '?'}` : '🔗 Havola orqali';
  const msgDesc  = st.message ? `\n💬 Izoh: <i>${esc(st.message)}</i>` : '';
  await ctx.editMessageText(
    `🎁 <b>Tasdiqlash</b>\n\n🎀 Gift: <b>${esc(gift.name)}</b>\n💰 To'lov: ${payDesc}\n${toDesc}\n🕵️ Anonim: ${st.giftAnon ? 'Ha' : 'Yo\'q'}${msgDesc}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🟩 Tasdiqlash', callback_data: 'gconfirm_yes' }, { text: '🟥 Bekor', callback_data: 'gconfirm_no' }],
    ]}},
  );
}

async function processGiftPurchase(ctx, gift, st, userId, bot, ST) {
  const payWith  = st.giftPayWith || 'stars';
  const rate     = require('../database/sqlite').getSettingNum('conv_stars_uzs_rate', cfg.STARS_TO_UZS);
  const price    = Number(gift.price);
  const anon     = st.giftAnon || false;
  const target   = st.giftTarget || 'self';
  const message  = st.message || null;

  // Balance check
  if (payWith === 'stars') {
    const bal = await jdb.getStars(userId);
    if (bal < price) {
      return ctx.editMessageText(`❌ Stars yetarli emas!\n\n💰 Narx: ${price} ⭐\n💎 Sizda: ${bal} ⭐`, mainKb.back('buy_gift'));
    }
  } else {
    const uzsPrice = price * rate;
    const bal = await jdb.getUzs(userId);
    if (bal < uzsPrice) {
      return ctx.editMessageText(`❌ UZS yetarli emas!\n\n💰 Narx: ${fUzs(uzsPrice)}\n💵 Sizda: ${fUzs(bal)}`, mainKb.back('buy_gift'));
    }
  }

  if (!gramjs.isTgConnected()) {
    return ctx.editMessageText('❌ Telegram hisob ulanmagan! Admin ulanishi kerak.', mainKb.back());
  }

  // ── Via link ──
  if (target === 'link') {
    if (payWith === 'stars') await jdb.deductStars(userId, price);
    else await jdb.deductUzs(userId, price * rate);

    const bi   = await bot.telegram.getMe();
    const ap   = anon ? 'anon' : 'pub';
    const link = `https://t.me/${bi.username}?start=claim_${gift.id}_${userId}_${ap}`;

    sqlite.createOrder({ userId, type: 'gift_buy', amount: price, price: payWith === 'stars' ? price : price * rate, status: 'completed', meta: { giftId: gift.id, viaLink: true } });
    await refSvc.grantPurchaseCommission(userId, 'gift_buy', price, bot);

    return ctx.editMessageText(
      `✅ <b>Havola tayyor!</b>\n\n🎁 <b>${esc(gift.name)}</b>\n\n🔗 Do'stingizga yuboring:\n${link}\n\n⚠️ Bu havola faqat <b>bir marta</b> ishlatilishi mumkin!`,
      { parse_mode: 'HTML', ...require('../keyboards/mainKeyboard').back() }
    );
  }

  // ── To self / friend ──
  let targetId = userId;
  if (target === 'friend') {
    try {
      const userInfo = await bot.telegram.getChat(`@${st.friendUsername}`);
      targetId = userInfo.id;
    } catch {
      return ctx.editMessageText(`❌ @${st.friendUsername} topilmadi.`, mainKb.back('buy_gift'));
    }
  }

  await ctx.editMessageText('⏳ Gift yuborilmoqda...', { parse_mode: 'HTML' });

  if (payWith === 'stars') await jdb.deductStars(userId, price);
  else await jdb.deductUzs(userId, price * rate);

  const user = await jdb.getUser(userId);
  const res  = await gramjs.sendGiftGramJS(targetId, gift.telegramId || gift.id, anon, message, { userId, username: user?.username }, async (txt) => {
    try { await bot.telegram.sendMessage(cfg.ADMIN_ID, txt, { parse_mode: 'HTML' }); } catch {}
  });

  const orderId = sqlite.createOrder({
    userId, type: 'gift_buy', amount: price,
    price: payWith === 'stars' ? price : price * rate,
    status: res.ok ? 'completed' : 'rejected',
    error:  res.error || null,
    meta:   { giftId: gift.id, targetId, anonymous: anon },
  });

  if (res.ok) {
    await refSvc.grantPurchaseCommission(userId, 'gift_buy', price, bot);
    // Notify admin silently
    try {
      await bot.telegram.sendMessage(cfg.ADMIN_ID,
        `🎁 Gift yuborildi\n👤 ${user?.username || userId} → ${targetId}\n🎀 ${gift.name}`,
        { parse_mode: 'HTML' }
      );
    } catch {}
    await ctx.editMessageText(`✅ <b>Gift yuborildi!</b>\n🎁 ${esc(gift.name)}`, { parse_mode: 'HTML', ...mainKb.back() });
  } else if (res.error === 'spam_account') {
    if (payWith === 'stars') await jdb.addStars(userId, price); else await jdb.addUzs(userId, price * rate);
    await ctx.editMessageText(`❌ Akkaunt spam deb belgilangan.\n\nPul qaytarildi. Havola orqali yuborib ko'ring.`, mainKb.back('buy_gift'));
  } else if (res.error === 'balance_too_low') {
    if (payWith === 'stars') await jdb.addStars(userId, price); else await jdb.addUzs(userId, price * rate);
    await ctx.editMessageText('❌ Stars hisobda yetarli emas. Admin bilan bog\'laning.', mainKb.back());
  } else {
    await ctx.editMessageText(`❌ Xato: ${res.error}`, mainKb.back('buy_gift'));
  }

  if (ST[userId]) { delete ST[userId].selGift; delete ST[userId].giftPayWith; delete ST[userId].giftTarget; delete ST[userId].giftAnon; delete ST[userId].message; delete ST[userId].friendUsername; }
}

module.exports = { registerGiftHandlers, processGiftPurchase, askAnonMode, showGiftConfirm };
