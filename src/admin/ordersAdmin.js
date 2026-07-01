'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const admKb  = require('../keyboards/adminKeyboard');
const { fUzs, esc, orderStatusEmoji, orderTypeLabel, paginate, paginationButtons } = require('../utils/format');
const cfg    = require('../config');

function registerOrdersAdmin(bot, ST) {
  bot.action('adm_orders', async ctx => {
    await ctx.answerCbQuery();
    await showOrdersMenu(ctx);
  });

  bot.action(/^adm_orders_status_(.+)_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const status = ctx.match[1];
    const page   = parseInt(ctx.match[2], 10);
    await showOrdersByStatus(ctx, status, page);
  });

  bot.action(/^adm_orders_status_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const status = ctx.match[1];
    await showOrdersByStatus(ctx, status, 1);
  });

  bot.action(/^adm_order_view_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const order   = sqlite.getOrder(orderId);
    if (!order) return ctx.editMessageText('❌ Buyurtma topilmadi.', admKb.back());
    const user = await jdb.getUser(order.userId);
    await ctx.editMessageText(
      `📋 <b>Buyurtma</b>\n\n🆔 <code>${order.id}</code>\n👤 ${user?.username || order.userId} (<code>${order.userId}</code>)\n📦 ${orderTypeLabel(order.type)}\n💰 Miqdor: ${order.amount ?? '—'}\n💵 Narx: ${order.price ? fUzs(order.price) : '—'}\n${orderStatusEmoji(order.status)} Status: <b>${order.status}</b>\n📅 ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n${order.adminNotes ? `📝 ${esc(order.adminNotes)}` : ''}\n${order.error ? `🔴 Xato: ${esc(order.error)}` : ''}`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🟩 Tasdiqlash', callback_data: `adm_order_approve_${orderId}` }, { text: '🟥 Rad etish', callback_data: `adm_order_reject_${orderId}` }],
        [{ text: '⬅️ Orqaga', callback_data: 'adm_orders' }],
      ]}}
    );
  });

  bot.action(/^adm_order_approve_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const order   = sqlite.getOrder(orderId);
    if (!order) return ctx.editMessageText('❌ Buyurtma topilmadi.', admKb.back());
    sqlite.updateOrder(orderId, { status: 'completed' });
    // Notify user
    try {
      await bot.telegram.sendMessage(order.userId,
        `✅ <b>Buyurtma tasdiqlandi!</b>\n\n📋 <code>${orderId}</code>\n📦 ${orderTypeLabel(order.type)}`,
        { parse_mode: 'HTML' }
      );
    } catch {}
    await ctx.editMessageText(`✅ Buyurtma tasdiqlandi: <code>${orderId}</code>`, { parse_mode: 'HTML', ...admKb.back('adm_orders') });
  });

  bot.action(/^adm_order_reject_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const orderId  = ctx.match[1];
    const adminId  = ctx.from.id;
    const order    = sqlite.getOrder(orderId);
    if (!order) return ctx.editMessageText('❌ Buyurtma topilmadi.', admKb.back());
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].rejectOrderId = orderId;
    ST[adminId].step          = 'reject_reason';
    await ctx.editMessageText(
      `❌ <b>Rad etish sababi:</b>\n\nBuyurtma: <code>${orderId}</code>\n\nSababni kiriting (yoki /skip):`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⏭ Sabab yo\'q', callback_data: `adm_order_reject_confirm_${orderId}_` }]] }}
    );
  });

  bot.action(/^adm_order_reject_confirm_(.+?)_(.*)$/, async ctx => {
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const reason  = ctx.match[2] || '';
    await doRejectOrder(orderId, reason, bot, ctx);
  });
}

async function handleRejectReason(ctx, adminId, reason, ST, bot) {
  const orderId = ST[adminId]?.rejectOrderId;
  if (!orderId) return;
  delete ST[adminId].step;
  delete ST[adminId].rejectOrderId;
  await doRejectOrder(orderId, reason, bot, ctx);
}

async function doRejectOrder(orderId, reason, bot, ctx) {
  const order = sqlite.getOrder(orderId);
  if (!order) return ctx.reply('❌ Buyurtma topilmadi.');
  sqlite.updateOrder(orderId, { status: 'rejected', adminNotes: reason });
  // Refund logic
  if (order.type === 'stars_buy') await jdb.addUzs(order.userId, order.price || 0);
  if (order.type === 'premium_buy') await jdb.addStars(order.userId, order.price || 0);
  if (order.type === 'ton_buy') await jdb.addUzs(order.userId, order.price || 0);
  try {
    await bot.telegram.sendMessage(order.userId,
      `❌ <b>Buyurtma rad etildi.</b>\n\n📋 <code>${orderId}</code>\n${reason ? `📝 Sabab: ${reason}` : ''}\n\nPul qaytarildi.`,
      { parse_mode: 'HTML' }
    );
  } catch {}
  await ctx.reply(`✅ Rad etildi: <code>${orderId}</code>`, { parse_mode: 'HTML', ...require('../keyboards/adminKeyboard').back('adm_orders') });
}

async function showOrdersMenu(ctx) {
  const p = s => sqlite.countOrdersByStatus(s);
  await ctx.editMessageText(
    `📦 <b>Buyurtmalar</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: `⏳ Kutmoqda (${p('pending')})`, callback_data: 'adm_orders_status_pending' }],
      [{ text: `✅ Tugallangan (${p('completed')})`, callback_data: 'adm_orders_status_completed' }],
      [{ text: `❌ Rad etilgan (${p('rejected')})`, callback_data: 'adm_orders_status_rejected' }],
      [{ text: `📋 Hammasi`, callback_data: 'adm_orders_status_all' }],
      [{ text: '⬅️ Admin', callback_data: 'adm_panel' }],
    ]}}
  );
}

async function showOrdersByStatus(ctx, status, page) {
  const orders = status === 'all' ? sqlite.getAllOrders(200) : sqlite.getOrdersByStatus(status, 200);
  if (!orders.length) return ctx.editMessageText('📦 Buyurtmalar yo\'q.', require('../keyboards/adminKeyboard').back('adm_orders'));
  const { items, pages, total } = paginate(orders, page, 8);
  const rows = items.map(o => [{
    text: `${orderStatusEmoji(o.status)} ${orderTypeLabel(o.type)} — ${o.amount ?? '—'} (#${o.userId})`,
    callback_data: `adm_order_view_${o.id}`,
  }]);
  if (pages > 1) rows.push(paginationButtons(page, pages, `adm_orders_status_${status}`));
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'adm_orders' }]);
  await ctx.editMessageText(`📦 <b>${status} buyurtmalar</b> (${total})`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
}

module.exports = { registerOrdersAdmin, handleRejectReason };
