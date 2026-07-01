'use strict';
const sqlite = require('../database/sqlite');
const cfg    = require('../config');

function isAdminUser(userId) {
  return Number(userId) === cfg.ADMIN_ID || sqlite.isAdmin(userId);
}

function requireAdmin(permission = null) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (!isAdminUser(userId)) {
      return ctx.reply('⛔ Ruxsat yo\'q!');
    }
    if (permission && !sqlite.isSuperAdmin(userId) && !sqlite.hasPermission(userId, permission)) {
      return ctx.reply(`⛔ "${permission}" ruxsati yo\'q!`);
    }
    return next();
  };
}

module.exports = { isAdminUser, requireAdmin };
