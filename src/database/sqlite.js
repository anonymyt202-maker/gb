'use strict';
const { DatabaseSync } = require('node:sqlite');
const path     = require('path');
const fs       = require('fs');
const cfg      = require('../config');

let db = null;

function getDb() {
  if (!db) throw new Error('SQLite not initialized. Call initSqlite() first.');
  return db;
}

function initSqlite() {
  const dir = path.dirname(cfg.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(cfg.DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      userId      INTEGER NOT NULL,
      type        TEXT NOT NULL,
      amount      REAL,
      price       REAL,
      status      TEXT NOT NULL DEFAULT 'pending',
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL,
      adminNotes  TEXT,
      proof       TEXT,
      error       TEXT,
      meta        TEXT
    );

    CREATE TABLE IF NOT EXISTS admins (
      userId      INTEGER PRIMARY KEY,
      username    TEXT,
      addedBy     INTEGER,
      isSuperAdmin INTEGER NOT NULL DEFAULT 0,
      addedAt     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      userId      INTEGER NOT NULL,
      permission  TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (userId, permission)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referral_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      inviterId   INTEGER NOT NULL,
      inviteeId   INTEGER NOT NULL,
      type        TEXT NOT NULL,
      amount      REAL NOT NULL DEFAULT 0,
      locked      INTEGER NOT NULL DEFAULT 0,
      lockedUntil TEXT,
      unlockedAt  TEXT,
      createdAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_settings (
      id          INTEGER PRIMARY KEY DEFAULT 1,
      apiUrl      TEXT,
      apiKey      TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      lastSuccess TEXT,
      lastError   TEXT,
      lastBalance REAL
    );

    CREATE TABLE IF NOT EXISTS payment_channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channelId   TEXT NOT NULL UNIQUE,
      title       TEXT,
      purpose     TEXT,
      isDefault   INTEGER NOT NULL DEFAULT 0,
      addedAt     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      level     TEXT NOT NULL,
      message   TEXT NOT NULL,
      meta      TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversion_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL,
      stars     REAL NOT NULL,
      uzs       REAL NOT NULL,
      rate      REAL NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      userId    INTEGER NOT NULL,
      action    TEXT NOT NULL,
      lastAt    TEXT NOT NULL,
      count     INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (userId, action)
    );
  `);

  // Seed default settings
  const defaults = {
    star_buy_price:        '140',
    star_min_buy:          '10',
    star_sell_enabled:     '1',
    star_buy_enabled:      '1',
    premium_1m_price:      '500',
    premium_3m_price:      '1200',
    premium_6m_price:      '2200',
    premium_12m_price:     '4000',
    ton_buy_base_price:    '19000',
    ton_buy_pct:           '10',
    ton_sell_base_price:   '19000',
    ton_sell_pct:          '5',
    ton_wallet:            '',
    referral_start_bonus:  '1',
    referral_lock_days:    '7',
    referral_stars_pct:    '5',
    referral_gift_pct:     '2',
    referral_premium_pct:  '3',
    referral_ton_pct:      '2',
    conv_stars_uzs_enabled:'1',
    conv_stars_uzs_rate:   '140',
    conv_min_stars:        '1',
    conv_max_stars:        '10000',
    ai_enabled:            '0',
    ai_system_prompt:      'You are a helpful assistant for a Telegram marketplace bot. Only answer questions about Stars, Premium, TON, orders, referral, payments, and bot usage.',
    groq_model:            'llama3-8b-8192',
    stars_sell_channel:    '',
    ton_sell_channel:      '',
  };

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  db.exec('BEGIN TRANSACTION');
  try {
    for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  // Ensure api_settings row exists
  db.prepare('INSERT OR IGNORE INTO api_settings (id, apiUrl, apiKey) VALUES (1, ?, ?)').run(
    cfg.FRAGMENT_API_URL, cfg.FRAGMENT_API_KEY
  );

  return db;
}

// ── SETTINGS ─────────────────────────────────────────────────
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function getSettingNum(key, def = 0) {
  const v = getSetting(key);
  const n = Number(v);
  return isNaN(n) ? def : n;
}
function getSettingBool(key, def = false) {
  const v = getSetting(key);
  if (v === null) return def;
  return v === '1' || v === 'true';
}
function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}
function getAllSettings() {
  return getDb().prepare('SELECT key, value FROM settings').all().reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// ── ORDERS ────────────────────────────────────────────────────
function createOrder(data) {
  const now = new Date().toISOString();
  const id  = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  getDb().prepare(`
    INSERT INTO orders (id, userId, type, amount, price, status, createdAt, updatedAt, adminNotes, proof, error, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.userId, data.type, data.amount || null, data.price || null,
    data.status || 'pending', now, now,
    data.adminNotes || null, data.proof || null, data.error || null,
    data.meta ? JSON.stringify(data.meta) : null);
  return id;
}

function updateOrder(id, patch) {
  const now    = new Date().toISOString();
  const fields = [];
  const vals   = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'meta') { fields.push('meta = ?'); vals.push(JSON.stringify(v)); }
    else { fields.push(`${k} = ?`); vals.push(v); }
  }
  fields.push('updatedAt = ?'); vals.push(now); vals.push(id);
  getDb().prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
}

function getOrder(id) {
  const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (row && row.meta) { try { row.meta = JSON.parse(row.meta); } catch {} }
  return row;
}

function getOrdersByUser(userId, limit = 20, offset = 0) {
  return getDb().prepare('SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(userId, limit, offset).map(r => { if (r.meta) { try { r.meta = JSON.parse(r.meta); } catch {} } return r; });
}

function getOrdersByStatus(status, limit = 50, offset = 0) {
  return getDb().prepare('SELECT * FROM orders WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(status, limit, offset);
}

function getOrdersByType(type, limit = 50, offset = 0) {
  return getDb().prepare('SELECT * FROM orders WHERE type = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(type, limit, offset);
}

function getAllOrders(limit = 50, offset = 0) {
  return getDb().prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(limit, offset);
}

function countOrdersByStatus(status) {
  return getDb().prepare('SELECT COUNT(*) as c FROM orders WHERE status = ?').get(status)?.c || 0;
}

function hasPendingOrder(userId, type) {
  const row = getDb().prepare('SELECT id FROM orders WHERE userId = ? AND type = ? AND status = ?').get(userId, type, 'pending');
  return !!row;
}

// ── ADMINS ────────────────────────────────────────────────────
function addAdmin(userId, username, addedBy, isSuperAdmin = 0) {
  getDb().prepare('INSERT OR REPLACE INTO admins (userId, username, addedBy, isSuperAdmin, addedAt) VALUES (?, ?, ?, ?, ?)')
    .run(userId, username, addedBy, isSuperAdmin ? 1 : 0, new Date().toISOString());
}
function removeAdmin(userId) {
  getDb().prepare('DELETE FROM admins WHERE userId = ?').run(userId);
  getDb().prepare('DELETE FROM permissions WHERE userId = ?').run(userId);
}
function getAdmin(userId) {
  return getDb().prepare('SELECT * FROM admins WHERE userId = ?').get(userId);
}
function getAllAdmins() {
  return getDb().prepare('SELECT * FROM admins ORDER BY isSuperAdmin DESC, addedAt ASC').all();
}
function isAdmin(userId) {
  return !!getDb().prepare('SELECT userId FROM admins WHERE userId = ?').get(userId);
}
function isSuperAdmin(userId) {
  const row = getDb().prepare('SELECT isSuperAdmin FROM admins WHERE userId = ?').get(userId);
  return row?.isSuperAdmin === 1;
}

// ── PERMISSIONS ───────────────────────────────────────────────
const ALL_PERMISSIONS = ['users','broadcast','orders','stars','premium','ton','referrals','api','statistics','channels','settings','database','logs','admins'];

function setPermission(userId, permission, enabled) {
  getDb().prepare('INSERT OR REPLACE INTO permissions (userId, permission, enabled) VALUES (?, ?, ?)').run(userId, permission, enabled ? 1 : 0);
}
function hasPermission(userId, permission) {
  if (isSuperAdmin(userId)) return true;
  const row = getDb().prepare('SELECT enabled FROM permissions WHERE userId = ? AND permission = ?').get(userId, permission);
  return row?.enabled === 1;
}
function getPermissions(userId) {
  const rows = getDb().prepare('SELECT permission, enabled FROM permissions WHERE userId = ?').all(userId);
  const map  = {};
  for (const p of ALL_PERMISSIONS) map[p] = false;
  for (const r of rows) map[r.permission] = r.enabled === 1;
  return map;
}
function setAllPermissions(userId, enabled) {
  const db2 = getDb();
  db2.exec('BEGIN TRANSACTION');
  try {
    for (const p of ALL_PERMISSIONS) {
      db2.prepare('INSERT OR REPLACE INTO permissions (userId, permission, enabled) VALUES (?, ?, ?)').run(userId, p, enabled ? 1 : 0);
    }
    db2.exec('COMMIT');
  } catch (e) { db2.exec('ROLLBACK'); throw e; }
}

// ── REFERRAL LEDGER ───────────────────────────────────────────
function addReferralEntry(data) {
  getDb().prepare(`
    INSERT INTO referral_ledger (inviterId, inviteeId, type, amount, locked, lockedUntil, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.inviterId, data.inviteeId, data.type, data.amount, data.locked ? 1 : 0,
    data.lockedUntil || null, new Date().toISOString());
}
function getReferralStats(inviterId) {
  const db2 = getDb();
  return {
    total:   db2.prepare('SELECT COUNT(DISTINCT inviteeId) as c FROM referral_ledger WHERE inviterId = ?').get(inviterId)?.c || 0,
    locked:  db2.prepare('SELECT COALESCE(SUM(amount),0) as s FROM referral_ledger WHERE inviterId = ? AND locked = 1').get(inviterId)?.s || 0,
    unlocked:db2.prepare('SELECT COALESCE(SUM(amount),0) as s FROM referral_ledger WHERE inviterId = ? AND locked = 0').get(inviterId)?.s || 0,
    earnings:db2.prepare('SELECT COALESCE(SUM(amount),0) as s FROM referral_ledger WHERE inviterId = ?').get(inviterId)?.s || 0,
    today:   db2.prepare("SELECT COUNT(DISTINCT inviteeId) as c FROM referral_ledger WHERE inviterId = ? AND date(createdAt) = date('now')").get(inviterId)?.c || 0,
  };
}
function getLockedRewardsReadyToUnlock() {
  const now = new Date().toISOString();
  return getDb().prepare('SELECT * FROM referral_ledger WHERE locked = 1 AND lockedUntil <= ?').all(now);
}
function unlockReferralEntry(id) {
  getDb().prepare('UPDATE referral_ledger SET locked = 0, unlockedAt = ? WHERE id = ?').run(new Date().toISOString(), id);
}
function getTopInviters(limit = 10) {
  return getDb().prepare(`
    SELECT inviterId, COUNT(DISTINCT inviteeId) as referrals, COALESCE(SUM(amount),0) as earnings
    FROM referral_ledger GROUP BY inviterId ORDER BY referrals DESC LIMIT ?
  `).all(limit);
}

// ── API SETTINGS ──────────────────────────────────────────────
function getApiSettings() {
  return getDb().prepare('SELECT * FROM api_settings WHERE id = 1').get() || {};
}
function updateApiSettings(patch) {
  const fields = Object.keys(patch).map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE api_settings SET ${fields} WHERE id = 1`).run(...Object.values(patch));
}

// ── PAYMENT CHANNELS ──────────────────────────────────────────
function addPaymentChannel(channelId, title, purpose) {
  getDb().prepare('INSERT OR IGNORE INTO payment_channels (channelId, title, purpose, addedAt) VALUES (?, ?, ?, ?)').run(channelId, title, purpose, new Date().toISOString());
}
function removePaymentChannel(id) {
  getDb().prepare('DELETE FROM payment_channels WHERE id = ?').run(id);
}
function getPaymentChannels() {
  return getDb().prepare('SELECT * FROM payment_channels ORDER BY isDefault DESC, id ASC').all();
}
function setDefaultChannel(id) {
  getDb().prepare('UPDATE payment_channels SET isDefault = 0').run();
  getDb().prepare('UPDATE payment_channels SET isDefault = 1 WHERE id = ?').run(id);
}
function getDefaultChannel() {
  return getDb().prepare('SELECT * FROM payment_channels WHERE isDefault = 1').get();
}
function getChannelByPurpose(purpose) {
  return getDb().prepare('SELECT * FROM payment_channels WHERE purpose = ?').get(purpose);
}

// ── LOGS ─────────────────────────────────────────────────────
function addLog(level, message, meta = null) {
  getDb().prepare('INSERT INTO logs (level, message, meta, createdAt) VALUES (?, ?, ?, ?)').run(level, message, meta ? JSON.stringify(meta) : null, new Date().toISOString());
}
function getLogs(limit = 100, offset = 0, level = null) {
  if (level) return getDb().prepare('SELECT * FROM logs WHERE level = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(level, limit, offset);
  return getDb().prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
}

// ── CONVERSION HISTORY ────────────────────────────────────────
function addConversionRecord(userId, stars, uzs, rate) {
  getDb().prepare('INSERT INTO conversion_history (userId, stars, uzs, rate, createdAt) VALUES (?, ?, ?, ?, ?)').run(userId, stars, uzs, rate, new Date().toISOString());
}
function getConversionHistory(userId, limit = 10) {
  return getDb().prepare('SELECT * FROM conversion_history WHERE userId = ? ORDER BY id DESC LIMIT ?').all(userId, limit);
}

// ── RATE LIMITS ───────────────────────────────────────────────
function checkRateLimit(userId, action, limitMs) {
  const now = Date.now();
  const row = getDb().prepare('SELECT lastAt, count FROM rate_limits WHERE userId = ? AND action = ?').get(userId, action);
  if (row) {
    const last = new Date(row.lastAt).getTime();
    if (now - last < limitMs) return false;
  }
  getDb().prepare('INSERT OR REPLACE INTO rate_limits (userId, action, lastAt, count) VALUES (?, ?, ?, ?)').run(userId, action, new Date().toISOString(), (row?.count || 0) + 1);
  return true;
}

// ── STATISTICS ────────────────────────────────────────────────
function getGlobalStats() {
  const db2 = getDb();
  return {
    totalOrders:     db2.prepare('SELECT COUNT(*) as c FROM orders').get()?.c || 0,
    pendingOrders:   db2.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get()?.c || 0,
    completedOrders: db2.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").get()?.c || 0,
    totalAdmins:     db2.prepare('SELECT COUNT(*) as c FROM admins').get()?.c || 0,
    totalLogs:       db2.prepare('SELECT COUNT(*) as c FROM logs').get()?.c || 0,
    ordersToday:     db2.prepare("SELECT COUNT(*) as c FROM orders WHERE date(createdAt) = date('now')").get()?.c || 0,
  };
}

module.exports = {
  initSqlite, getDb,
  getSetting, getSettingNum, getSettingBool, setSetting, getAllSettings,
  createOrder, updateOrder, getOrder, getOrdersByUser, getOrdersByStatus,
  getOrdersByType, getAllOrders, countOrdersByStatus, hasPendingOrder,
  addAdmin, removeAdmin, getAdmin, getAllAdmins, isAdmin, isSuperAdmin,
  ALL_PERMISSIONS, setPermission, hasPermission, getPermissions, setAllPermissions,
  addReferralEntry, getReferralStats, getLockedRewardsReadyToUnlock, unlockReferralEntry, getTopInviters,
  getApiSettings, updateApiSettings,
  addPaymentChannel, removePaymentChannel, getPaymentChannels, setDefaultChannel, getDefaultChannel, getChannelByPurpose,
  addLog, getLogs,
  addConversionRecord, getConversionHistory,
  checkRateLimit,
  getGlobalStats,
  // Convenience aliases & extras
  init: initSqlite,
  getTotalReferrals,
  getTotalCommissions,
  getLockedRewards,
  unlockExpiredRewards,
  setAdminScopes,
  getAdminInfo,
};

function getTotalReferrals() {
  return getDb().prepare('SELECT COUNT(*) as c FROM referral_ledger').get()?.c || 0;
}
function getTotalCommissions() {
  return getDb().prepare('SELECT COALESCE(SUM(amount),0) as s FROM referral_ledger WHERE locked = 0').get()?.s || 0;
}
function getLockedRewards(userId) {
  return getDb().prepare('SELECT *, lockedUntil as unlockAt FROM referral_ledger WHERE inviterId = ? AND locked = 1 ORDER BY lockedUntil ASC').all(userId);
}
function unlockExpiredRewards() {
  const now = new Date().toISOString();
  const rows = getDb().prepare('SELECT * FROM referral_ledger WHERE locked = 1 AND lockedUntil <= ?').all(now);
  if (rows.length) {
    const db2 = getDb();
    db2.exec('BEGIN TRANSACTION');
    try {
      for (const r of rows) {
        db2.prepare('UPDATE referral_ledger SET locked = 0, unlockedAt = ? WHERE id = ?').run(now, r.id);
      }
      db2.exec('COMMIT');
    } catch (e) { db2.exec('ROLLBACK'); throw e; }
  }
  return rows;
}
function setAdminScopes(userId, scopes) {
  const db2 = getDb();
  db2.exec('BEGIN TRANSACTION');
  try {
    db2.prepare('DELETE FROM permissions WHERE userId = ?').run(userId);
    for (const s of scopes) {
      db2.prepare('INSERT OR REPLACE INTO permissions (userId, permission, enabled) VALUES (?, ?, 1)').run(userId, s);
    }
    db2.exec('COMMIT');
  } catch (e) { db2.exec('ROLLBACK'); throw e; }
}
function getAdminInfo(userId) {
  const admin = getDb().prepare('SELECT * FROM admins WHERE userId = ?').get(userId);
  if (!admin) return null;
  const perms = getDb().prepare('SELECT permission FROM permissions WHERE userId = ? AND enabled = 1').all(userId);
  admin.scopes = JSON.stringify(perms.map(p => p.permission));
  return admin;
}
