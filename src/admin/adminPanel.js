'use strict';
const sqlite  = require('../database/sqlite');
const admKb   = require('../keyboards/adminKeyboard');
const cfg     = require('../config');

function registerAdminPanel(bot, ST) {
  bot.action('adm_panel', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (Number(userId) !== cfg.ADMIN_ID && !sqlite.isAdmin(userId)) {
      return ctx.answerCbQuery('⛔ Ruxsat yo\'q!', { show_alert: true });
    }
    await ctx.editMessageText('⚙️ <b>Admin Panel</b>', { parse_mode: 'HTML', ...admKb.admin(userId) });
  });

  bot.command('admin', async ctx => {
    const userId = ctx.from.id;
    if (Number(userId) !== cfg.ADMIN_ID && !sqlite.isAdmin(userId)) return;
    await ctx.reply('⚙️ <b>Admin Panel</b>', { parse_mode: 'HTML', ...admKb.admin(userId) });
  });
}

module.exports = { registerAdminPanel };
