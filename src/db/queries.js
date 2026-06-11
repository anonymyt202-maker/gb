import { runQuery, runUpdate } from './database.js';
import { v4 as uuidv4 } from 'uuid';

// ========== USERS ==========

export async function getUserByTelegramId(telegramId) {
  const rows = await runQuery('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
  return rows[0] || null;
}

export async function createUser(telegramId, username, firstName) {
  const referralCode = uuidv4().slice(0, 8);
  await runUpdate(`
    INSERT INTO users (telegram_id, username, first_name, referral_code)
    VALUES (?, ?, ?, ?)
  `, [telegramId, username, firstName, referralCode]);
  return getUserByTelegramId(telegramId);
}

export async function updateUserBalance(userId, rmCoins = 0, stars = 0, uzs = 0) {
  await runUpdate(`
    UPDATE users 
    SET rm_coins = rm_coins + ?, stars = stars + ?, uzs = uzs + ?
    WHERE id = ?
  `, [rmCoins, stars, uzs, userId]);
  return getUserById(userId);
}

export async function setUserBalance(userId, rmCoins, stars, uzs) {
  await runUpdate(`
    UPDATE users 
    SET rm_coins = ?, stars = ?, uzs = ?
    WHERE id = ?
  `, [rmCoins, stars, uzs, userId]);
  return getUserById(userId);
}

export async function getUserById(userId) {
  const rows = await runQuery('SELECT * FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
}

export async function getAllUsers(limit = 100, offset = 0) {
  return runQuery('SELECT * FROM users LIMIT ? OFFSET ?', [limit, offset]);
}

export async function searchUsers(query) {
  const searchTerm = `%${query}%`;
  return runQuery(`
    SELECT * FROM users 
    WHERE username LIKE ? OR first_name LIKE ? OR telegram_id LIKE ?
    LIMIT 50
  `, [searchTerm, searchTerm, searchTerm]);
}

export async function banUser(userId) {
  await runUpdate('UPDATE users SET is_banned = 1 WHERE id = ?', [userId]);
}

export async function unbanUser(userId) {
  await runUpdate('UPDATE users SET is_banned = 0 WHERE id = ?', [userId]);
}

// ========== GIFTS ==========

export async function createGift(name, description, imageUrl, priceRmCoins, category = 'General') {
  const result = await runUpdate(`
    INSERT INTO gifts (name, description, image_url, price_rm_coins, category)
    VALUES (?, ?, ?, ?, ?)
  `, [name, description, imageUrl, priceRmCoins, category]);
  return runQuery('SELECT * FROM gifts WHERE id = ?', [result.lastID]).then(rows => rows[0]);
}

export async function getGiftById(giftId) {
  const rows = await runQuery('SELECT * FROM gifts WHERE id = ?', [giftId]);
  return rows[0] || null;
}

export async function getAllGifts() {
  return runQuery('SELECT * FROM gifts WHERE is_active = 1 ORDER BY category, name');
}

export async function getGiftsByCategory(category) {
  return runQuery('SELECT * FROM gifts WHERE category = ? AND is_active = 1', [category]);
}

export async function updateGift(giftId, updates) {
  const allowedFields = ['name', 'description', 'image_url', 'price_rm_coins', 'category', 'stock', 'is_active'];
  const fields = Object.keys(updates).filter(k => allowedFields.includes(k));
  if (fields.length === 0) return getGiftById(giftId);
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(giftId);
  
  await runUpdate(`UPDATE gifts SET ${setClause} WHERE id = ?`, values);
  return getGiftById(giftId);
}

export async function deleteGift(giftId) {
  await runUpdate('DELETE FROM gifts WHERE id = ?', [giftId]);
}

// ========== CASES ==========

export async function createCase(name, description, imageUrl, priceRmCoins) {
  const result = await runUpdate(`
    INSERT INTO cases (name, description, image_url, price_rm_coins)
    VALUES (?, ?, ?, ?)
  `, [name, description, imageUrl, priceRmCoins]);
  return runQuery('SELECT * FROM cases WHERE id = ?', [result.lastID]).then(rows => rows[0]);
}

export async function getCaseById(caseId) {
  const rows = await runQuery('SELECT * FROM cases WHERE id = ?', [caseId]);
  return rows[0] || null;
}

export async function getAllCases() {
  return runQuery('SELECT * FROM cases WHERE is_active = 1');
}

export async function updateCase(caseId, updates) {
  const allowedFields = ['name', 'description', 'image_url', 'price_rm_coins', 'is_active'];
  const fields = Object.keys(updates).filter(k => allowedFields.includes(k));
  if (fields.length === 0) return getCaseById(caseId);
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(caseId);
  
  await runUpdate(`UPDATE cases SET ${setClause} WHERE id = ?`, values);
  return getCaseById(caseId);
}

export async function deleteCase(caseId) {
  await runUpdate('DELETE FROM cases WHERE id = ?', [caseId]);
  await runUpdate('DELETE FROM case_rewards WHERE case_id = ?', [caseId]);
}

export async function addCaseReward(caseId, rewardType, rewardValue, dropChance, stock = -1) {
  await runUpdate(`
    INSERT INTO case_rewards (case_id, reward_type, reward_value, drop_chance, stock)
    VALUES (?, ?, ?, ?, ?)
  `, [caseId, rewardType, rewardValue, dropChance, stock]);
}

export async function getCaseRewards(caseId) {
  return runQuery('SELECT * FROM case_rewards WHERE case_id = ?', [caseId]);
}

// ========== ORDERS ==========

export async function createOrder(userId, giftId, targetTelegramId, targetUsername, amountRmCoins, anonymous = false, message = null) {
  const result = await runUpdate(`
    INSERT INTO orders (user_id, gift_id, target_telegram_id, target_username, amount_rm_coins, anonymous, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [userId, giftId, targetTelegramId, targetUsername, amountRmCoins, anonymous ? 1 : 0, message]);
  return runQuery('SELECT * FROM orders WHERE id = ?', [result.lastID]).then(rows => rows[0]);
}

export async function getOrderById(orderId) {
  const rows = await runQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0] || null;
}

export async function getUserOrders(userId, limit = 50) {
  return runQuery('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
}

export async function getAllOrders(limit = 100, offset = 0) {
  return runQuery('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
}

export async function updateOrderStatus(orderId, status) {
  await runUpdate('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  return getOrderById(orderId);
}

// ========== GAME SESSIONS ==========

export async function createGameSession(userId, gameType, betAmount) {
  const result = await runUpdate(`
    INSERT INTO game_sessions (user_id, game_type, bet_amount)
    VALUES (?, ?, ?)
  `, [userId, gameType, betAmount]);
  return runQuery('SELECT * FROM game_sessions WHERE id = ?', [result.lastID]).then(rows => rows[0]);
}

export async function getGameSessionById(sessionId) {
  const rows = await runQuery('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);
  return rows[0] || null;
}

export async function updateGameSession(sessionId, winAmount, multiplier, status = 'completed') {
  await runUpdate('UPDATE game_sessions SET win_amount = ?, multiplier = ?, status = ? WHERE id = ?',
    [winAmount, multiplier, status, sessionId]);
  return getGameSessionById(sessionId);
}

export async function getUserGameHistory(userId, gameType = null, limit = 50) {
  if (gameType) {
    return runQuery('SELECT * FROM game_sessions WHERE user_id = ? AND game_type = ? ORDER BY created_at DESC LIMIT ?',
      [userId, gameType, limit]);
  }
  return runQuery('SELECT * FROM game_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]);
}

// ========== REFERRALS ==========

export async function createReferral(inviterId, invitedId) {
  await runUpdate(`
    INSERT INTO referrals (inviter_id, invited_id)
    VALUES (?, ?)
  `, [inviterId, invitedId]);
}

export async function getReferralsByInviter(inviterId) {
  return runQuery('SELECT * FROM referrals WHERE inviter_id = ?', [inviterId]);
}

export async function getReferralStats() {
  const rows = await runQuery(`
    SELECT 
      COUNT(*) as total_referrals,
      SUM(CASE WHEN rewarded = 1 THEN 1 ELSE 0 END) as rewarded,
      SUM(reward_stars) as total_bonus_stars
    FROM referrals
  `);
  return rows[0] || { total_referrals: 0, rewarded: 0, total_bonus_stars: 0 };
}

export async function getTopReferrers(limit = 10) {
  return runQuery(`
    SELECT u.id, u.username, u.first_name, u.telegram_id, COUNT(r.id) as count
    FROM users u
    LEFT JOIN referrals r ON u.id = r.inviter_id
    GROUP BY u.id
    ORDER BY count DESC
    LIMIT ?
  `, [limit]);
}

// ========== PROMO CODES ==========

export async function createPromoCode(code, discountType, discountValue, maxUses, expiresAt = null) {
  const result = await runUpdate(`
    INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `, [code, discountType, discountValue, maxUses, expiresAt]);
  return runQuery('SELECT * FROM promo_codes WHERE id = ?', [result.lastID]).then(rows => rows[0]);
}

export async function getPromoCodeByCode(code) {
  const rows = await runQuery('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1', [code]);
  return rows[0] || null;
}

export async function getAllPromoCodes() {
  return runQuery('SELECT * FROM promo_codes ORDER BY created_at DESC');
}

export async function updatePromoCode(codeId, updates) {
  const allowedFields = ['discount_type', 'discount_value', 'max_uses', 'is_active', 'expires_at'];
  const fields = Object.keys(updates).filter(k => allowedFields.includes(k));
  if (fields.length === 0) return runQuery('SELECT * FROM promo_codes WHERE id = ?', [codeId]).then(rows => rows[0]);
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(codeId);
  
  await runUpdate(`UPDATE promo_codes SET ${setClause} WHERE id = ?`, values);
  return runQuery('SELECT * FROM promo_codes WHERE id = ?', [codeId]).then(rows => rows[0]);
}

export async function incrementPromoCodeUsage(codeId) {
  await runUpdate('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [codeId]);
}

export async function deletePromoCode(codeId) {
  await runUpdate('DELETE FROM promo_codes WHERE id = ?', [codeId]);
}

// ========== CASE OPENS ==========

export async function createCaseOpen(userId, caseId, rewardType, rewardValue) {
  await runUpdate(`
    INSERT INTO case_opens (user_id, case_id, reward_type, reward_value)
    VALUES (?, ?, ?, ?)
  `, [userId, caseId, rewardType, rewardValue]);
}

export async function getUserCaseOpens(userId, limit = 50) {
  return runQuery('SELECT * FROM case_opens WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]);
}
