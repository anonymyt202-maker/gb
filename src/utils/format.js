'use strict';

const esc  = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fUzs = n => Number(n || 0).toLocaleString('uz-UZ') + ' UZS';
const fStars = n => `${Number(n || 0)} ⭐`;
const fTon   = n => `${Number(n || 0).toFixed(2)} TON`;

const tmeUrl = u => {
  const t = String(u || '').trim();
  if (!t) return '';
  if (t.startsWith('https://t.me/')) return t;
  if (t.startsWith('t.me/'))  return `https://t.me/${t.slice(5)}`;
  if (t.startsWith('@'))      return `https://t.me/${t.slice(1)}`;
  if (/^[A-Za-z0-9_]{5,32}$/.test(t)) return `https://t.me/${t}`;
  return t;
};

const remStr = ms => {
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return `${h}h ${m}m`;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const shortId = id => String(id).slice(0, 8).toUpperCase();

const orderStatusEmoji = status => ({
  pending:    '⏳',
  paid:       '💳',
  processing: '⚙️',
  completed:  '✅',
  rejected:   '🟥',
  cancelled:  '❌',
}[status] || '❓');

const orderTypeLabel = type => ({
  stars_buy:       '⭐ Stars sotib olish',
  stars_sell:      '⭐ Stars sotish',
  premium_buy:     '💎 Premium sotib olish',
  ton_buy:         '💰 TON sotib olish',
  ton_sell:        '💸 TON sotish',
  gift_buy:        '🎁 Gift sotib olish',
  referral_lock:   '🔒 Referral (locked)',
  referral_unlock: '🔓 Referral (unlocked)',
  conversion:      '🔄 Konversiya',
}[type] || type);

const premiumMonthLabel = m => ({
  1:  '1 oy',
  3:  '3 oy',
  6:  '6 oy',
  12: '12 oy',
}[m] || `${m} oy`);

function paginate(arr, page, pageSize = 10) {
  const total = arr.length;
  const pages = Math.ceil(total / pageSize);
  const items = arr.slice((page - 1) * pageSize, page * pageSize);
  return { items, page, pages, total };
}

function paginationButtons(page, pages, prefix) {
  const btns = [];
  if (page > 1)    btns.push({ text: '◀️', callback_data: `${prefix}_${page - 1}` });
  btns.push({ text: `${page}/${pages}`, callback_data: 'noop' });
  if (page < pages) btns.push({ text: '▶️', callback_data: `${prefix}_${page + 1}` });
  return btns;
}

module.exports = {
  esc, fUzs, fStars, fTon, tmeUrl, remStr, sleep,
  shortId, orderStatusEmoji, orderTypeLabel, premiumMonthLabel,
  paginate, paginationButtons,
};
