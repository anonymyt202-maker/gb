'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const mainKb = require('../keyboards/mainKeyboard');
const { fUzs } = require('../utils/format');
const cfg    = require('../config');

function registerDepositHandlers(bot, ST) {
  bot.action('dep_uzs', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'uzs_amount';
    const card = cfg.CARD_NUMBER;
    await ctx.editMessageText(
      `💵 <b>UZS kiritish</b>\n\n🏦 Karta raqami:\n<code>${card}</code>\n\nQancha UZS kiritmoqchisiz? (raqamni kiriting):`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
    );
  });

  bot.action('dep_stars', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'stars_amount';
    await ctx.editMessageText(
      '⭐ <b>Stars kiritish</b>\n\nNechta Stars kiritmoqchisiz?',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
    );
  });
}

async function sendStarsInvoice(ctx, amount) {
  const userId = ctx.from.id;
  await ctx.replyWithInvoice({
    title          : `⭐ ${amount} Stars kiritish`,
    description    : `Hisobingizga ${amount} Telegram Stars qo'shiladi`,
    payload        : JSON.stringify({ action: 'stars_dep', amount, user_id: userId }),
    provider_token : '',
    currency       : 'XTR',
    prices         : [{ label: `${amount} Stars`, amount }],
    start_parameter: 'stars_dep',
    need_name: false, need_phone_number: false, need_email: false, need_shipping_address: false,
  });
}

async function handleUzsDeposit(ctx, userId, amount, ST, bot) {
  if (!ST[userId]) ST[userId] = {};
  ST[userId].uzsAmount = amount;
  ST[userId].step      = 'uzs_check';
  const card = cfg.CARD_NUMBER;
  await ctx.reply(
    `💵 <b>To'lov</b>\n\n💰 Miqdor: <b>${fUzs(amount)}</b>\n🏦 Karta: <code>${card}</code>\n\n✅ Kartaga ${fUzs(amount)} o'tkazing.\n📸 Chekini yuboring:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🟥 Bekor', callback_data: 'main' }]] }}
  );
}

async function handleUzsCheck(ctx, userId, photoFileId, ST, bot) {
  const amount = ST[userId]?.uzsAmount;
  if (!amount) return ctx.reply('❌ Xato. Qayta urinib ko\'ring.');
  const deps = await jdb.getDeposits();
  const dep  = { id: String(Date.now()), userId, amount, proof: photoFileId, status: 'pending', createdAt: new Date().toISOString() };
  deps.push(dep);
  await jdb.saveDeposits(deps);
  sqlite.createOrder({ userId, type: 'uzs_deposit', amount, price: amount, status: 'pending', proof: photoFileId });
  delete ST[userId].step;
  delete ST[userId].uzsAmount;
  await ctx.reply(
    `✅ <b>So'rov yuborildi!</b>\n\n💰 Miqdor: ${fUzs(amount)}\n\n⏳ Admin tekshirib, hisobingizga qo'shadi.`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
  // Notify admin
  const user = await jdb.getUser(userId);
  try {
    await bot.telegram.sendPhoto(cfg.ADMIN_ID, photoFileId, {
      caption: `💵 UZS depozit\n👤 ${user?.username || userId} (<code>${userId}</code>)\n💰 ${fUzs(amount)}\n\nID: ${dep.id}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [{ text: '🟩 Tasdiqlash', callback_data: `adm_dep_ok_${userId}_${amount}` }, { text: '🟥 Rad', callback_data: `adm_dep_no_${userId}` }],
      ]},
    });
  } catch {
    try {
      await bot.telegram.sendMessage(cfg.ADMIN_ID,
        `💵 UZS depozit\n👤 ${user?.username || userId} (<code>${userId}</code>)\n💰 ${fUzs(amount)}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: '🟩 Tasdiqlash', callback_data: `adm_dep_ok_${userId}_${amount}` }, { text: '🟥 Rad', callback_data: `adm_dep_no_${userId}` }],
        ]}}
      );
    } catch {}
  }
}

async function handleStarsPayment(ctx, bot) {
  try {
    const payload = JSON.parse(ctx.preCheckoutQuery?.invoice_payload || '{}');
    if (payload.action === 'stars_dep') {
      await ctx.answerPreCheckoutQuery(true);
    } else {
      await ctx.answerPreCheckoutQuery(false, 'Noto\'g\'ri buyurtma');
    }
  } catch {
    try { await ctx.answerPreCheckoutQuery(false, 'Xato'); } catch {}
  }
}

async function handleSuccessfulPayment(ctx, bot) {
  try {
    const payment = ctx.message?.successful_payment;
    if (!payment) return;
    const payload = JSON.parse(payment.invoice_payload || '{}');
    if (payload.action === 'stars_dep') {
      const amount = payment.total_amount;
      const userId = ctx.from.id;
      await jdb.addStars(userId, amount);
      sqlite.createOrder({ userId, type: 'stars_deposit', amount, price: amount, status: 'completed' });
      const stars = await jdb.getStars(userId);
      await ctx.reply(
        `✅ <b>Stars qo'shildi!</b>\n\n⭐ +${amount} Stars\n💼 Jami: ${stars} Stars`,
        { parse_mode: 'HTML', ...mainKb.back() }
      );
    }
  } catch (e) {}
}

module.exports = { registerDepositHandlers, sendStarsInvoice, handleUzsDeposit, handleUzsCheck, handleStarsPayment, handleSuccessfulPayment };
