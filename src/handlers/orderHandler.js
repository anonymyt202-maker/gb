'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const mainKb = require('../keyboards/mainKeyboard');
const { fUzs, orderStatusEmoji, orderTypeLabel, paginate, paginationButtons } = require('../utils/format');

function registerOrderHandlers(bot, ST) {
  bot.action('my_orders', async ctx => {
    await ctx.answerCbQuery();
    await showUserOrders(ctx, ctx.from.id, 1);
  });

  bot.action(/^my_orders_p_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    await showUserOrders(ctx, ctx.from.id, parseInt(ctx.match[1], 10));
  });

  bot.action(/^order_view_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const order   = sqlite.getOrder(orderId);
    if (!order || Number(order.userId) !== ctx.from.id) {
      return ctx.editMessageText('❌ Buyurtma topilmadi.', mainKb.back('my_orders'));
    }
    await ctx.editMessageText(
      `📋 <b>Buyurtma</b>\n\n` +
      `🆔 <code>${order.id}</code>\n` +
      `📦 Tur: ${orderTypeLabel(order.type)}\n` +
      `💰 Miqdor: ${order.amount ?? '—'}\n` +
      `💵 Narx: ${order.price ? fUzs(order.price) : '—'}\n` +
      `${orderStatusEmoji(order.status)} Status: <b>${order.status}</b>\n` +
      `📅 Sana: ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n` +
      (order.adminNotes ? `📝 Izoh: ${order.adminNotes}` : ''),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'my_orders' }]] }}
    );
  });
}

async function showUserOrders(ctx, userId, page = 1) {
  const orders = sqlite.getOrdersByUser(userId, 100);
  if (!orders.length) {
    return ctx.editMessageText('📦 Buyurtmalar yo\'q.', mainKb.back());
  }
  const { items, pages } = paginate(orders, page, 5);
  const rows = items.map(o => [{
    text: `${orderStatusEmoji(o.status)} ${orderTypeLabel(o.type)} — ${o.amount ?? '—'} (${o.status})`,
    callback_data: `order_view_${o.id}`,
  }]);
  if (pages > 1) rows.push(paginationButtons(page, pages, 'my_orders_p'));
  rows.push([{ text: '⬅️ Orqaga', callback_data: 'main' }]);
  await ctx.editMessageText(`📦 <b>Buyurtmalarim</b> (${orders.length} ta)`, {
    parse_mode: 'HTML', reply_markup: { inline_keyboard: rows },
  });
}

module.exports = { registerOrderHandlers };
