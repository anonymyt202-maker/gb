'use strict';
const jdb   = require('../database/json');
const { esc } = require('../utils/format');

function registerBroadcastAdmin(bot, ST) {
  bot.action('adm_broadcast', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'broadcast_text';
    await ctx.editMessageText(
      '📢 <b>Xabar yuborish</b>\n\nBarcha foydalanuvchilarga yuboriladigan xabarni kiriting:',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Bekor', callback_data: 'adm_panel' }]] }}
    );
  });

  bot.action('adm_broadcast_confirm', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    const text    = ST[adminId]?.broadcastText;
    if (!text) return ctx.editMessageText('❌ Xabar topilmadi.', require('../keyboards/adminKeyboard').back());
    delete ST[adminId].broadcastText;
    delete ST[adminId].step;
    await ctx.editMessageText('📢 Xabar yuborilmoqda...');
    const users = await jdb.getUsers();
    let ok = 0, fail = 0;
    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.userId, text, { parse_mode: 'HTML' });
        ok++;
        await new Promise(r => setTimeout(r, 50));
      } catch { fail++; }
    }
    await ctx.reply(
      `✅ <b>Yuborildi!</b>\n\n✅ Muvaffaqiyatli: ${ok}\n❌ Xato: ${fail}`,
      { parse_mode: 'HTML', ...require('../keyboards/adminKeyboard').back('adm_panel') }
    );
  });

  bot.action('adm_broadcast_cancel', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (ST[adminId]) { delete ST[adminId].broadcastText; delete ST[adminId].step; }
    await ctx.editMessageText('❌ Bekor qilindi.', require('../keyboards/adminKeyboard').back('adm_panel'));
  });
}

async function handleBroadcastStep(ctx, adminId, text, ST) {
  if (ST[adminId]?.step !== 'broadcast_text') return false;
  ST[adminId].broadcastText = text;
  delete ST[adminId].step;
  await ctx.reply(
    `📢 <b>Xabar preview:</b>\n\n${text}\n\n${(await jdb.getUsers()).length} ta foydalanuvchiga yuboriladi.`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '✅ Yuborish', callback_data: 'adm_broadcast_confirm' }, { text: '❌ Bekor', callback_data: 'adm_broadcast_cancel' }],
    ]}}
  );
  return true;
}

module.exports = { registerBroadcastAdmin, handleBroadcastStep };
