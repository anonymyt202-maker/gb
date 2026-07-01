'use strict';
const { isTgConnected } = require('../utils/gramjs');
const sqlite = require('../database/sqlite');

function admin(userId) {
  const sp = sqlite.isSuperAdmin(userId);
  const hp = p => sp || sqlite.hasPermission(userId, p);
  const st = isTgConnected() ? '🟢 Ulangan' : '🔴 Ulanmagan';
  const rows = [
    [{ text: `📱 TG hisob: ${st}`, callback_data: 'adm_tg' }],
  ];
  if (hp('statistics'))   rows.push([{ text: '📊 Statistika', callback_data: 'adm_stats' }, { text: '📋 Loglar', callback_data: 'adm_logs' }]);
  if (hp('orders'))       rows.push([{ text: '📦 Buyurtmalar', callback_data: 'adm_orders' }]);
  if (hp('users'))        rows.push([{ text: '👤 Foydalanuvchilar', callback_data: 'adm_users' }]);
  if (hp('stars'))        rows.push([{ text: '⭐ Stars sozlamalari', callback_data: 'adm_stars' }]);
  if (hp('premium'))      rows.push([{ text: '💎 Premium sozlamalari', callback_data: 'adm_premium' }]);
  if (hp('ton'))          rows.push([{ text: '💰 TON sozlamalari', callback_data: 'adm_ton' }]);
  if (hp('referrals'))    rows.push([{ text: '👥 Referral', callback_data: 'adm_referral' }]);
  if (hp('api'))          rows.push([{ text: '🔌 API sozlamalari', callback_data: 'adm_api' }]);
  if (hp('channels'))     rows.push([{ text: '📺 Kanallar', callback_data: 'adm_channels' }]);
  if (hp('broadcast'))    rows.push([{ text: '📢 Broadcast', callback_data: 'adm_broadcast' }]);
  if (hp('settings'))     rows.push([{ text: '⚙️ Sozlamalar', callback_data: 'adm_settings' }]);
  if (sp)                 rows.push([{ text: '👑 Adminlar', callback_data: 'adm_permissions' }]);
  rows.push([{ text: '⬅️ Bosh menyu', callback_data: 'main' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

const back = (cb = 'adm_panel') => ({ reply_markup: { inline_keyboard: [
  [{ text: '⬅️ Admin panel', callback_data: cb }],
]}});

const confirmAction = (yesCb, noCb, label = 'Tasdiqlash') => ({ reply_markup: { inline_keyboard: [
  [{ text: `🟩 ${label}`, callback_data: yesCb }, { text: '🟥 Bekor', callback_data: noCb }],
]}});

module.exports = { admin, back, confirmAction };
