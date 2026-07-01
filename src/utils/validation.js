'use strict';

function isValidAmount(val, min = 1, max = Infinity) {
  const n = Number(val);
  return !isNaN(n) && n >= min && n <= max && Number.isFinite(n);
}

function isValidInt(val, min = 1, max = Infinity) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= min && n <= max;
}

function isValidUsername(u) {
  return /^[A-Za-z0-9_]{4,32}$/.test(String(u || '').replace(/^@/, ''));
}

function isValidApiKey(k) {
  return typeof k === 'string' && k.length >= 8;
}

function isValidChannelId(id) {
  const s = String(id || '').trim();
  if (s.startsWith('@')) return /^@[A-Za-z0-9_]{4,}$/.test(s);
  if (s.startsWith('-100')) return /^-100\d{7,}$/.test(s);
  return /^-\d{7,}$/.test(s) || /^@[A-Za-z0-9_]{4,}$/.test(s);
}

function isValidPct(val) {
  const n = Number(val);
  return !isNaN(n) && n >= 0 && n <= 100;
}

function sanitizeAmount(val) {
  return parseInt(String(val).replace(/[\s,]/g, ''), 10);
}

function sanitizeUsername(val) {
  return String(val || '').trim().replace(/^@/, '');
}

module.exports = {
  isValidAmount, isValidInt, isValidUsername,
  isValidApiKey, isValidChannelId, isValidPct,
  sanitizeAmount, sanitizeUsername,
};
