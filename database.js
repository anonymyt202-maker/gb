const Database = require('better-sqlite3');
const cfg = require('./config');

const db = new Database(cfg.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  rm_coins REAL DEFAULT 0,
  stars REAL DEFAULT 0,
  uzs REAL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  referral_rewarded INTEGER DEFAULT 0,
  purchases_count INTEGER DEFAULT 0,
  last_daily_bonus TEXT,
  last_slots_at TEXT,
  is_banned INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price_rm INTEGER NOT NULL,
  tg_gift_id TEXT NOT NULL,
  sticker_url TEXT,
  image_url TEXT,
  file_path TEXT,
  category TEXT DEFAULT 'Umumiy',
  stock INTEGER DEFAULT -1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  gift_id INTEGER REFERENCES gifts(id),
  target_telegram_id INTEGER,
  target_username TEXT,
  amount_rm REAL NOT NULL,
  pay_with TEXT DEFAULT 'rm',
  anonymous INTEGER DEFAULT 0,
  comment TEXT,
  promo_code TEXT,
  status TEXT DEFAULT 'pending',
  error_msg TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT DEFAULT 'percent',
  discount_value REAL NOT NULL,
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER REFERENCES users(id),
  invited_id INTEGER REFERENCES users(id),
  reward_rm REAL DEFAULT 0,
  rewarded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tg_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  session_string TEXT,
  username TEXT,
  first_name TEXT,
  tg_id INTEGER,
  is_active INTEGER DEFAULT 1,
  stars_balance INTEGER DEFAULT 0,
  gifts_sent INTEGER DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_used TEXT
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_url TEXT,
  price_rm INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  is_limited INTEGER DEFAULT 0,
  total_supply INTEGER DEFAULT -1,
  opened_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  chance REAL NOT NULL,
  image_url TEXT,
  rarity TEXT DEFAULT 'common'
);

CREATE TABLE IF NOT EXISTS case_opens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  case_id INTEGER REFERENCES cases(id),
  prize_id INTEGER REFERENCES case_prizes(id),
  prize_name TEXT,
  prize_value TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  amount_uzs REAL NOT NULL,
  amount_rm REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  screenshot_path TEXT,
  admin_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_history (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  user_id INTEGER REFERENCES users(id),
	  game TEXT NOT NULL,
	  bet_rm REAL NOT NULL,
	  multiplier REAL,
	  win_rm REAL,
	  result TEXT,
	  created_at TEXT DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS inventory (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  user_id INTEGER REFERENCES users(id),
	  item_type TEXT NOT NULL, -- 'gift', 'nft'
	  item_name TEXT NOT NULL,
	  item_value TEXT,
	  item_image TEXT,
	  is_sold INTEGER DEFAULT 0,
	  is_withdrawn INTEGER DEFAULT 0,
	  created_at TEXT DEFAULT (datetime('now'))
	);
	`);

// ─── User ─────────────────────────────────────────────────────────
const genCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

function getUser(telegram_id) {
  return db.prepare('SELECT * FROM users WHERE telegram_id=?').get(telegram_id);
}

function getOrCreateUser(telegram_id, username, first_name) {
  let user = getUser(telegram_id);
  if (!user) {
    db.prepare(`INSERT INTO users (telegram_id,username,first_name,referral_code)
      VALUES (?,?,?,?)`).run(telegram_id, username || null, first_name || null, genCode());
    user = getUser(telegram_id);
    return { user, isNew: true };
  }
  db.prepare('UPDATE users SET username=?,first_name=? WHERE telegram_id=?')
    .run(username || user.username, first_name || user.first_name, telegram_id);
  return { user: getUser(telegram_id), isNew: false };
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}

function getUserByRefCode(code) {
  return db.prepare('SELECT * FROM users WHERE referral_code=?').get(code);
}

function addRmCoins(telegram_id, amount) {
  db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(amount, telegram_id);
}

function deductRmCoins(telegram_id, amount) {
  db.prepare('UPDATE users SET rm_coins=MAX(0,rm_coins-?) WHERE telegram_id=?').run(amount, telegram_id);
}

function addReferral(inviter_id, invited_id, reward_rm) {
  const existing = db.prepare('SELECT id FROM referrals WHERE invited_id=?').get(invited_id);
  if (existing) return;
  db.prepare('INSERT INTO referrals (inviter_id,invited_id,reward_rm,rewarded) VALUES (?,?,?,1)')
    .run(inviter_id, invited_id, reward_rm);
  addRmCoins(db.prepare('SELECT telegram_id FROM users WHERE id=?').get(inviter_id)?.telegram_id, reward_rm);
}

function getAllUsers(search = null) {
  if (search) {
    const isNum = /^\d+$/.test(search);
    return db.prepare(`SELECT * FROM users WHERE 
      username LIKE ? OR first_name LIKE ? ${isNum ? 'OR telegram_id=?' : ''}
      ORDER BY id DESC LIMIT 200`)
      .all(`%${search}%`, `%${search}%`, ...(isNum ? [parseInt(search)] : []));
  }
  return db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 200').all();
}

function updateBalance(telegram_id, rm_delta, stars_delta, uzs_delta) {
  const sets = [];
  const vals = [];
  if (rm_delta !== undefined)    { sets.push('rm_coins=MAX(0,rm_coins+?)');  vals.push(rm_delta); }
  if (stars_delta !== undefined) { sets.push('stars=MAX(0,stars+?)');        vals.push(stars_delta); }
  if (uzs_delta !== undefined)   { sets.push('uzs=MAX(0,uzs+?)');            vals.push(uzs_delta); }
  if (!sets.length) return;
  db.prepare(`UPDATE users SET ${sets.join(',')} WHERE telegram_id=?`).run(...vals, telegram_id);
}

function banUser(telegram_id, ban) {
  db.prepare('UPDATE users SET is_banned=? WHERE telegram_id=?').run(ban ? 1 : 0, telegram_id);
}

// ─── Gifts ────────────────────────────────────────────────────────
function getGifts({ category, search, adminAll = false } = {}) {
  let q = 'SELECT * FROM gifts WHERE 1=1';
  const params = [];
  if (!adminAll) { q += ' AND is_active=1'; }
  if (category)  { q += ' AND category=?'; params.push(category); }
  if (search)    { q += ' AND name LIKE ?'; params.push(`%${search}%`); }
  q += ' ORDER BY id DESC';
  return db.prepare(q).all(...params);
}

function getGift(id) {
  return db.prepare('SELECT * FROM gifts WHERE id=?').get(id);
}

function createGift(data) {
  const r = db.prepare(`INSERT INTO gifts (name,description,price_rm,tg_gift_id,sticker_url,image_url,file_path,category,stock)
    VALUES (@name,@description,@price_rm,@tg_gift_id,@sticker_url,@image_url,@file_path,@category,@stock)`).run(data);
  return getGift(r.lastInsertRowid);
}

function updateGift(id, data) {
  const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
  db.prepare(`UPDATE gifts SET ${fields} WHERE id=@id`).run({ ...data, id });
  return getGift(id);
}

function deleteGift(id) {
  db.prepare('DELETE FROM gifts WHERE id=?').run(id);
}

function getGiftCategories() {
  return db.prepare('SELECT DISTINCT category FROM gifts WHERE is_active=1').all().map(r => r.category);
}

// ─── Orders ───────────────────────────────────────────────────────
function createOrder(data) {
  const r = db.prepare(`INSERT INTO orders 
    (user_id,gift_id,target_telegram_id,target_username,amount_rm,pay_with,anonymous,comment,promo_code,status)
    VALUES (@user_id,@gift_id,@target_telegram_id,@target_username,@amount_rm,@pay_with,@anonymous,@comment,@promo_code,@status)`)
    .run(data);
  return r.lastInsertRowid;
}

function updateOrder(id, status, error_msg = null) {
  db.prepare("UPDATE orders SET status=?,error_msg=?,updated_at=datetime('now') WHERE id=?")
    .run(status, error_msg, id);
}

function getUserOrders(user_id) {
  return db.prepare(`SELECT o.*,g.name as gift_name FROM orders o
    LEFT JOIN gifts g ON g.id=o.gift_id
    WHERE o.user_id=? ORDER BY o.id DESC LIMIT 50`).all(user_id);
}

function getAllOrders(status = null) {
  let q = `SELECT o.*,u.username,u.telegram_id as u_tg_id,g.name as gift_name
    FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN gifts g ON g.id=o.gift_id`;
  if (status) q += ' WHERE o.status=?';
  q += ' ORDER BY o.id DESC LIMIT 200';
  return status ? db.prepare(q).all(status) : db.prepare(q).all();
}

// ─── Promo ────────────────────────────────────────────────────────
function getPromo(code) {
  return db.prepare("SELECT * FROM promo_codes WHERE code=? AND is_active=1").get(code.toUpperCase());
}

function usePromo(id) {
  db.prepare('UPDATE promo_codes SET used_count=used_count+1 WHERE id=?').run(id);
}

function createPromo(data) {
  const r = db.prepare(`INSERT INTO promo_codes (code,discount_type,discount_value,max_uses,expires_at)
    VALUES (@code,@discount_type,@discount_value,@max_uses,@expires_at)`).run(data);
  return db.prepare('SELECT * FROM promo_codes WHERE id=?').get(r.lastInsertRowid);
}

function getAllPromos() {
  return db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all();
}

function deletePromo(id) {
  db.prepare('DELETE FROM promo_codes WHERE id=?').run(id);
}

// ─── Accounts ─────────────────────────────────────────────────────
function getAccounts() {
  return db.prepare('SELECT * FROM tg_accounts ORDER BY id DESC').all();
}

function getActiveAccount() {
  return db.prepare('SELECT * FROM tg_accounts WHERE is_active=1 LIMIT 1').get();
}

function upsertAccount(phone, data) {
  const existing = db.prepare('SELECT id FROM tg_accounts WHERE phone=?').get(phone);
  if (existing) {
    db.prepare(`UPDATE tg_accounts SET session_string=?,username=?,first_name=?,tg_id=?,is_active=1 WHERE phone=?`)
      .run(data.session, data.username || null, data.first_name || null, data.tg_id || null, phone);
  } else {
    db.prepare(`INSERT INTO tg_accounts (phone,session_string,username,first_name,tg_id) VALUES (?,?,?,?,?)`)
      .run(phone, data.session, data.username || null, data.first_name || null, data.tg_id || null);
  }
}

function toggleAccount(id) {
  const acc = db.prepare('SELECT is_active FROM tg_accounts WHERE id=?').get(id);
  if (!acc) return null;
  db.prepare('UPDATE tg_accounts SET is_active=? WHERE id=?').run(acc.is_active ? 0 : 1, id);
  return db.prepare('SELECT * FROM tg_accounts WHERE id=?').get(id);
}

function deleteAccount(id) {
  db.prepare('DELETE FROM tg_accounts WHERE id=?').run(id);
}

function accountGiftSent(id) {
  db.prepare("UPDATE tg_accounts SET gifts_sent=gifts_sent+1,last_used=datetime('now') WHERE id=?").run(id);
}

// ─── Cases ────────────────────────────────────────────────────────
function getCases(adminAll = false) {
  let q = 'SELECT * FROM cases';
  if (!adminAll) q += ' WHERE is_active=1';
  q += ' ORDER BY id DESC';
  const cases = db.prepare(q).all();
  return cases.map(c => ({
    ...c,
    prizes: db.prepare('SELECT * FROM case_prizes WHERE case_id=? ORDER BY chance DESC').all(c.id)
  }));
}

function getCase(id) {
  const c = db.prepare('SELECT * FROM cases WHERE id=?').get(id);
  if (!c) return null;
  c.prizes = db.prepare('SELECT * FROM case_prizes WHERE case_id=? ORDER BY chance DESC').all(id);
  return c;
}

function createCase(caseData, prizes) {
  const r = db.prepare(`INSERT INTO cases (name,image_url,price_rm,is_limited,total_supply)
    VALUES (@name,@image_url,@price_rm,@is_limited,@total_supply)`).run(caseData);
  const caseId = r.lastInsertRowid;
  for (const p of prizes) {
    db.prepare(`INSERT INTO case_prizes (case_id,name,type,value,chance,image_url,rarity)
      VALUES (?,?,?,?,?,?,?)`).run(caseId, p.name, p.type, p.value, p.chance, p.image_url || null, p.rarity || 'common');
  }
  return getCase(caseId);
}

function openCase(userId, caseId) {
	  const c = getCase(caseId);
	  if (!c) return null;
	  // Random prize tanlash
	  const rand = Math.random() * 100;
	  let cumulative = 0;
	  let selected = c.prizes[c.prizes.length - 1];
	  for (const p of c.prizes.sort((a, b) => b.chance - a.chance)) {
	    cumulative += p.chance;
	    if (rand <= cumulative) { selected = p; break; }
	  }
	  // Case ochilishini saqlash
	  db.prepare(`INSERT INTO case_opens (user_id,case_id,prize_id,prize_name,prize_value)
	    VALUES (?,?,?,?,?)`).run(userId, caseId, selected.id, selected.name, selected.value);
	  db.prepare('UPDATE cases SET opened_count=opened_count+1 WHERE id=?').run(caseId);

	  // Agar gift yoki nft bo'lsa inventoryga qo'shish
	  if (selected.type === 'gift' || selected.type === 'nft') {
	    db.prepare(`INSERT INTO inventory (user_id, item_type, item_name, item_value, item_image)
	      VALUES (?, ?, ?, ?, ?)`).run(userId, selected.type, selected.name, selected.value, selected.image_url);
	  }

	  return { prize: selected, case: c };
	}

	function getUserInventory(userId) {
	  return db.prepare('SELECT * FROM inventory WHERE user_id=? AND is_sold=0 AND is_withdrawn=0 ORDER BY id DESC').all(userId);
	}

	function sellInventoryItem(userId, itemId, priceRm) {
	  const item = db.prepare('SELECT * FROM inventory WHERE id=? AND user_id=? AND is_sold=0').get(itemId, userId);
	  if (!item) return null;
	  db.prepare('UPDATE inventory SET is_sold=1 WHERE id=?').run(itemId);
	  db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE id=?').run(priceRm, userId);
	  return true;
	}

function deleteCase(id) {
  db.prepare('DELETE FROM case_prizes WHERE case_id=?').run(id);
  db.prepare('DELETE FROM cases WHERE id=?').run(id);
}

// ─── Payment requests ─────────────────────────────────────────────
function createPaymentRequest(user_id, amount_uzs, amount_rm, screenshot_path) {
  const r = db.prepare(`INSERT INTO payment_requests (user_id,amount_uzs,amount_rm,screenshot_path)
    VALUES (?,?,?,?)`).run(user_id, amount_uzs, amount_rm, screenshot_path || null);
  return r.lastInsertRowid;
}

function getPaymentRequests(status = null) {
  let q = `SELECT pr.*,u.telegram_id,u.username FROM payment_requests pr
    LEFT JOIN users u ON u.id=pr.user_id`;
  if (status) q += ' WHERE pr.status=?';
  q += ' ORDER BY pr.id DESC LIMIT 100';
  return status ? db.prepare(q).all(status) : db.prepare(q).all();
}

function updatePayment(id, status, admin_note = null) {
  db.prepare("UPDATE payment_requests SET status=?,admin_note=?,updated_at=datetime('now') WHERE id=?")
    .run(status, admin_note, id);
  return db.prepare('SELECT * FROM payment_requests WHERE id=?').get(id);
}

// ─── Channels ─────────────────────────────────────────────────────
function getChannels() {
  return db.prepare('SELECT * FROM channels WHERE is_active=1').all();
}

function addChannel(channel_id, channel_name) {
  db.prepare('INSERT OR REPLACE INTO channels (channel_id,channel_name) VALUES (?,?)').run(channel_id, channel_name);
}

function removeChannel(id) {
  db.prepare('DELETE FROM channels WHERE id=?').run(id);
}

// ─── Game history ─────────────────────────────────────────────────
function saveGameHistory(user_id, game, bet_rm, multiplier, win_rm, result) {
  db.prepare(`INSERT INTO game_history (user_id,game,bet_rm,multiplier,win_rm,result)
    VALUES (?,?,?,?,?,?)`).run(user_id, game, bet_rm, multiplier, win_rm, result);
}

// ─── Dashboard stats ──────────────────────────────────────────────
function getDashboardStats() {
  const cfg = require('./config');
  return {
    total_users:   db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    total_gifts:   db.prepare('SELECT COUNT(*) as c FROM gifts').get().c,
    total_orders:  db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    success_orders:db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='success'").get().c,
    pending_orders:db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c,
    failed_orders: db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='failed'").get().c,
    total_rm:      db.prepare('SELECT COALESCE(SUM(rm_coins),0) as s FROM users').get().s,
    total_uzs:     db.prepare('SELECT COALESCE(SUM(uzs),0) as s FROM users').get().s,
    revenue_rm:    db.prepare("SELECT COALESCE(SUM(amount_rm),0) as s FROM orders WHERE status='success'").get().s,
    active_accounts: db.prepare('SELECT COUNT(*) as c FROM tg_accounts WHERE is_active=1').get().c,
    total_cases:   db.prepare('SELECT COUNT(*) as c FROM cases').get().c,
    total_case_opens: db.prepare('SELECT COUNT(*) as c FROM case_opens').get().c,
    pending_payments: db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='pending'").get().c,
    rm_to_uzs: cfg.RM_TO_UZS,
    rm_to_stars: cfg.RM_TO_STARS,
    referral_reward: cfg.REFERRAL_REWARD,
  };
}

function getReferralStats() {
  return {
    total: db.prepare('SELECT COUNT(*) as c FROM referrals').get().c,
    rewarded: db.prepare('SELECT COUNT(*) as c FROM referrals WHERE rewarded=1').get().c,
    total_bonus: db.prepare('SELECT COALESCE(SUM(reward_rm),0) as s FROM referrals').get().s,
    top: db.prepare(`SELECT u.username,u.telegram_id,COUNT(r.id) as cnt
      FROM referrals r JOIN users u ON u.id=r.inviter_id
      GROUP BY r.inviter_id ORDER BY cnt DESC LIMIT 10`).all()
  };
}

module.exports = {
  db,
  getUser, getOrCreateUser, getUserById, getUserByRefCode,
  addRmCoins, deductRmCoins, addReferral, getAllUsers,
  updateBalance, banUser,
  getGifts, getGift, createGift, updateGift, deleteGift, getGiftCategories,
  createOrder, updateOrder, getUserOrders, getAllOrders,
  getPromo, usePromo, createPromo, getAllPromos, deletePromo,
  getAccounts, getActiveAccount, upsertAccount, toggleAccount, deleteAccount, accountGiftSent,
  getCases, getCase, createCase, openCase, deleteCase,
  createPaymentRequest, getPaymentRequests, updatePayment,
  getChannels, addChannel, removeChannel,
  saveGameHistory, getDashboardStats, getReferralStats,
};
