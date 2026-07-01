'use strict';
const sqlite = require('../database/sqlite');
const cfg    = require('../config');
const { esc } = require('../utils/format');

function registerPermissionsAdmin(bot, ST) {
  bot.action('adm_permissions', async ctx => {
    await ctx.answerCbQuery();
    await showAdmins(ctx);
  });

  bot.action('adm_perm_add', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (Number(adminId) !== cfg.ADMIN_ID) return ctx.answerCbQuery('⛔ Faqat super admin!', { show_alert: true });
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'perm_add_id';
    await ctx.editMessageText('👤 Yangi admin ID raqamini kiriting:', {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_permissions' }]] }
    });
  });

  bot.action(/^adm_perm_del_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    if (Number(ctx.from.id) !== cfg.ADMIN_ID) return ctx.answerCbQuery('⛔ Faqat super admin!', { show_alert: true });
    const targetId = Number(ctx.match[1]);
    sqlite.removeAdmin(targetId);
    await showAdmins(ctx);
  });

  // Scope toggles
  bot.action(/^adm_perm_toggle_(.+)_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    if (Number(ctx.from.id) !== cfg.ADMIN_ID) return;
    const scope    = ctx.match[1];
    const targetId = Number(ctx.match[2]);
    const admin    = sqlite.getAdminInfo(targetId);
    if (!admin) return;
    const scopes = JSON.parse(admin.scopes || '[]');
    const idx    = scopes.indexOf(scope);
    if (idx === -1) scopes.push(scope);
    else scopes.splice(idx, 1);
    sqlite.setAdminScopes(targetId, scopes);
    await showAdminDetail(ctx, targetId);
  });

  bot.action(/^adm_perm_view_(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    await showAdminDetail(ctx, Number(ctx.match[1]));
  });
}

async function showAdmins(ctx) {
  const admins = sqlite.getAllAdmins();
  const rows = admins.map(a => [{
    text: `👤 ${a.username || a.userId}`,
    callback_data: `adm_perm_view_${a.userId}`,
  }]);
  rows.push([{ text: '➕ Admin qo\'shish', callback_data: 'adm_perm_add' }]);
  rows.push([{ text: '⬅️ Admin', callback_data: 'adm_panel' }]);
  await ctx.editMessageText(`🔐 <b>Adminlar</b> (${admins.length} ta)`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
}

async function showAdminDetail(ctx, targetId) {
  const admin  = sqlite.getAdminInfo(targetId);
  if (!admin) return ctx.editMessageText('❌ Topilmadi.');
  const scopes   = JSON.parse(admin.scopes || '[]');
  const allScopes= ['orders','users','stars','premium','ton','referral','settings','broadcast','channels','api','permissions'];
  const scopeRows= allScopes.map(s => [{
    text: `${scopes.includes(s) ? '✅' : '⬜'} ${s}`,
    callback_data: `adm_perm_toggle_${s}_${targetId}`,
  }]);
  scopeRows.push([{ text: '🗑 O\'chirish', callback_data: `adm_perm_del_${targetId}` }, { text: '⬅️ Orqaga', callback_data: 'adm_permissions' }]);
  await ctx.editMessageText(
    `🔐 <b>Admin</b>: ${esc(admin.username || String(targetId))}\nID: <code>${targetId}</code>\n\nRuxsatlar:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: scopeRows } }
  );
}

async function handlePermAdminStep(ctx, adminId, text, ST, bot) {
  if (ST[adminId]?.step === 'perm_add_id') {
    const newId = parseInt(text, 10);
    if (isNaN(newId)) return ctx.reply('❌ To\'g\'ri ID kiriting:');
    delete ST[adminId].step;
    let username = '';
    try { const u = await bot.telegram.getChat(newId); username = u.username || ''; } catch {}
    sqlite.addAdmin(newId, username);
    await ctx.reply(`✅ Admin qo\'shildi: <code>${newId}</code>`, { parse_mode: 'HTML' });
    return true;
  }
  return false;
}

module.exports = { registerPermissionsAdmin, handlePermAdminStep };
