'use strict';
const jdb    = require('../database/json');
const sqlite = require('../database/sqlite');
const admKb  = require('../keyboards/adminKeyboard');
const { fUzs, esc, paginate, paginationButtons } = require('../utils/format');

function registerUsersAdmin(bot, ST) {
  bot.action('adm_users', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'find_user';
    await ctx.editMessageText(
      '👤 <b>Foydalanuvchi qidirish</b>\n\nFoydalanuvchi ID ni kiriting:',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Admin', callback_data: 'adm_panel' }]] }}
    );
  });

  bot.action(/^adm_users_list_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    await showUsersList(ctx, parseInt(ctx.match[1], 10));
  });

  bot.action('adm_users_list', async ctx => {
    await ctx.answerCbQuery();
    await showUsersList(ctx, 1);
  });

  // Add stars to user
  bot.action(/^admu_s_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const targetId = Number(ctx.match[1]);
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = `adds_${targetId}`;
    await ctx.reply(`⭐ @${targetId} ga nechta Stars qo'shmoqchisiz?`);
  });

  // Add UZS to user
  bot.action(/^admu_u_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const targetId = Number(ctx.match[1]);
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = `addu_${targetId}`;
    await ctx.reply(`💵 ${targetId} ga qancha UZS qo'shmoqchisiz?`);
  });

  // Deposit approval
  bot.action(/^adm_dep_ok_(\d+)_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const targetId = Number(ctx.match[1]);
    const amount   = Number(ctx.match[2]);
    await jdb.addUzs(targetId, amount);
    try { await bot.telegram.sendMessage(targetId, `✅ Hisobingizga <b>${fUzs(amount)}</b> qo'shildi!`, { parse_mode: 'HTML' }); } catch {}
    await ctx.reply(`✅ ${targetId} ga ${fUzs(amount)} qo'shildi.`, admKb.back());
  });

  bot.action(/^adm_dep_no_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const targetId = Number(ctx.match[1]);
    try { await bot.telegram.sendMessage(targetId, '❌ Depozit so\'rovingiz rad etildi.'); } catch {}
    await ctx.reply(`❌ Depozit rad etildi.`, admKb.back());
  });
}

async function handleUserSearch(ctx, adminId, userId, ST, bot) {
  delete ST[adminId].step;
  const user = await jdb.getUser(Number(userId));
  if (!user) return ctx.reply('❌ Topilmadi!', admKb.back());
  await ctx.reply(
    `👤 <b>Foydalanuvchi</b>\n\n🆔 <code>${user.userId}</code>\n📛 ${esc(user.username)}\n⭐ Stars: <b>${user.stars}</b>\n💵 UZS: <b>${fUzs(user.uzs)}</b>\n🔒 Locked Stars: ${user.lockedStars || 0}\n📅 Qo'shilgan: ${user.joinedAt}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '+⭐ Stars', callback_data: `admu_s_${user.userId}` }, { text: '+💵 UZS', callback_data: `admu_u_${user.userId}` }],
      [{ text: '⬅️ Admin', callback_data: 'adm_panel' }],
    ]}}
  );
}

async function showUsersList(ctx, page = 1) {
  const users = await jdb.getUsers();
  const { items, pages, total } = paginate(users, page, 10);
  const rows = items.map(u => [{ text: `👤 ${u.username || u.userId} — ⭐${u.stars}`, callback_data: `admu_view_${u.userId}` }]);
  if (pages > 1) rows.push(paginationButtons(page, pages, 'adm_users_list'));
  rows.push([{ text: '⬅️ Admin', callback_data: 'adm_panel' }]);
  await ctx.editMessageText(`👥 <b>Foydalanuvchilar</b> (${total} ta)`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
}

module.exports = { registerUsersAdmin, handleUserSearch };
