/**
 * routes.js
 * Barcha API endpointlar:
 * - /api/users      (Python: api/routers/users.py)
 * - /api/gifts      (Python: api/routers/gifts.py)
 * - /api/orders     (Python: api/routers/orders.py)
 * - /api/accounts   (Python: api/routers/accounts.py)
 * - /api/cases      (yangi)
 * - /api/payments   (yangi)
 * - /api/channels   (yangi)
 */

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');
const db = require('./database');
const { sendGift, getSessionInfo } = require('./giftSender');

const router = express.Router();

// Uploads papka
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auth middlewares ─────────────────────────────────────────────
function verifyWebAppData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const authDate = parseInt(params.get('auth_date') || '0');
    if (Date.now() / 1000 - authDate > 86400) return null; // 24 soat

    const dataCheckStr = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(cfg.BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckStr).digest('hex');

    if (expectedHash !== hash) return null;
    return JSON.parse(decodeURIComponent(params.get('user') || '{}'));
  } catch {
    return null;
  }
}

function authUser(req, res, next) {
  const initData = req.headers['x-init-data'];
  if (!initData) return res.status(401).json({ error: 'X-Init-Data header kerak' });
  
  // Dev mode: agar BOT_TOKEN test bo'lsa skip
  if (cfg.BOT_TOKEN === 'test' || process.env.DEV_MODE === 'true') {
    req.tgUser = { id: parseInt(req.headers['x-dev-user-id'] || '1'), username: 'dev', first_name: 'Dev' };
    return next();
  }
  
  const user = verifyWebAppData(initData);
  if (!user) return res.status(401).json({ error: 'initData yaroqsiz' });
  req.tgUser = user;
  next();
}

function authAdmin(req, res, next) {
  authUser(req, res, () => {
    if (!cfg.ADMIN_IDS.includes(req.tgUser.id)) {
      return res.status(403).json({ error: 'Faqat adminlar uchun' });
    }
    next();
  });
}

// ─── Gift formatters ──────────────────────────────────────────────
function fmtGift(g) {
  return {
    ...g,
    price_uzs: g.price_rm * cfg.RM_TO_UZS,
    price_stars: g.price_rm * cfg.RM_TO_STARS,
  };
}

// ═══════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════

router.get('/users/me', authUser, (req, res) => {
  const { user, isNew } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const refCount = db.db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(user.id)?.c || 0;
  const refLink = `https://t.me/${process.env.BOT_USERNAME || 'rmgiftbot'}?start=ref_${user.referral_code}`;
  
  res.json({
    telegram_id: user.telegram_id,
    username: user.username,
    first_name: user.first_name,
    rm_coins: user.rm_coins,
    stars: user.stars,
    uzs: user.uzs,
    referral_code: user.referral_code,
    referral_link: refLink,
    referral_count: refCount,
    purchases_count: user.purchases_count,
    is_premium: user.is_premium,
    rm_to_uzs: cfg.RM_TO_UZS,
    rm_to_stars: cfg.RM_TO_STARS,
    referral_reward: cfg.REFERRAL_REWARD,
  });
});

router.get('/users/admin/all', authAdmin, (req, res) => {
  res.json(db.getAllUsers(req.query.search));
});

router.post('/users/admin/balance', authAdmin, (req, res) => {
  const { telegram_id, rm_delta, stars_delta, uzs_delta } = req.body;
  if (!telegram_id) return res.status(400).json({ error: 'telegram_id kerak' });
  db.updateBalance(telegram_id, rm_delta, stars_delta, uzs_delta);
  const u = db.getUser(telegram_id);
  res.json({ ok: true, rm_coins: u?.rm_coins, stars: u?.stars, uzs: u?.uzs });
});

router.post('/users/admin/ban', authAdmin, (req, res) => {
  const { telegram_id, ban } = req.body;
  db.banUser(telegram_id, ban);
  res.json({ ok: true });
});

// Convert RM → UZS yoki Stars
router.post('/users/convert', authUser, (req, res) => {
  const { type, amount } = req.body; // type: 'rm_to_uzs' | 'rm_to_stars'
  const user = db.getUser(req.tgUser.id);
  if (!user) return res.status(404).json({ error: 'User topilmadi' });
  
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Miqdor noto\'g\'ri' });
  if (user.rm_coins < amt) return res.status(400).json({ error: 'RM Coin yetarli emas' });
  
  if (type === 'rm_to_uzs') {
    const uzs = amt * cfg.RM_TO_UZS;
    db.db.prepare('UPDATE users SET rm_coins=rm_coins-?,uzs=uzs+? WHERE telegram_id=?').run(amt, uzs, user.telegram_id);
    res.json({ ok: true, converted: uzs, currency: 'UZS' });
  } else if (type === 'rm_to_stars') {
    const stars = amt * cfg.RM_TO_STARS;
    db.db.prepare('UPDATE users SET rm_coins=rm_coins-?,stars=stars+? WHERE telegram_id=?').run(amt, stars, user.telegram_id);
    res.json({ ok: true, converted: stars, currency: 'Stars' });
  } else {
    res.status(400).json({ error: 'Noto\'g\'ri tur' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GIFTS
// ═══════════════════════════════════════════════════════════════════

router.get('/gifts', authUser, (req, res) => {
  res.json(db.getGifts({ category: req.query.category, search: req.query.search }).map(fmtGift));
});

router.get('/gifts/categories', authUser, (req, res) => {
  res.json(db.getGiftCategories());
});

router.get('/gifts/:id', authUser, (req, res) => {
  const g = db.getGift(parseInt(req.params.id));
  if (!g) return res.status(404).json({ error: 'Gift topilmadi' });
  res.json(fmtGift(g));
});

router.get('/gifts/admin/all', authAdmin, (req, res) => {
  res.json(db.getGifts({ adminAll: true }).map(fmtGift));
});

router.post('/gifts/admin', authAdmin, upload.single('file'), (req, res) => {
  const { name, price_rm, tg_gift_id, description, sticker_url, image_url, category, stock } = req.body;
  if (!name || !price_rm || !tg_gift_id) return res.status(400).json({ error: 'name, price_rm, tg_gift_id kerak' });
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  const g = db.createGift({
    name, description: description || null, price_rm: parseInt(price_rm),
    tg_gift_id, sticker_url: sticker_url || null,
    image_url: image_url || null, file_path,
    category: category || 'Umumiy', stock: parseInt(stock ?? -1),
  });
  res.json(fmtGift(g));
});

router.put('/gifts/admin/:id', authAdmin, upload.single('file'), (req, res) => {
  const id = parseInt(req.params.id);
  const g = db.getGift(id);
  if (!g) return res.status(404).json({ error: 'Gift topilmadi' });
  const update = {};
  const fields = ['name','price_rm','tg_gift_id','description','sticker_url','image_url','category','stock','is_active'];
  for (const f of fields) {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  }
  if (req.file) update.file_path = `/uploads/${req.file.filename}`;
  res.json(fmtGift(db.updateGift(id, update)));
});

router.delete('/gifts/admin/:id', authAdmin, (req, res) => {
  db.deleteGift(parseInt(req.params.id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════

router.post('/orders', authUser, async (req, res) => {
  const { gift_id, target_telegram_id, target_username, pay_with = 'rm', anonymous = false, comment, promo_code } = req.body;
  
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  if (user.is_banned) return res.status(403).json({ error: 'Hisobingiz bloklangan' });
  
  const gift = db.getGift(parseInt(gift_id));
  if (!gift || !gift.is_active) return res.status(404).json({ error: 'Gift topilmadi' });
  
  let price = gift.price_rm;
  let discount = 0;
  
  // Promo kod
  if (promo_code) {
    const promo = db.getPromo(promo_code);
    if (promo && (!promo.expires_at || new Date(promo.expires_at) > new Date()) && promo.used_count < promo.max_uses) {
      discount = promo.discount_type === 'percent'
        ? price * promo.discount_value / 100
        : promo.discount_value;
      db.usePromo(promo.id);
    }
  }
  price = Math.max(1, price - discount);
  
  // Balans tekshirish
  if (pay_with === 'rm') {
    if (user.rm_coins < price) return res.status(400).json({ error: `RM Coin yetarli emas. Sizda: ${user.rm_coins.toFixed(0)}, kerak: ${price}` });
    db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE telegram_id=?').run(price, user.telegram_id);
  } else if (pay_with === 'stars') {
    const starsPrice = price * cfg.RM_TO_STARS;
    if (user.stars < starsPrice) return res.status(400).json({ error: `Stars yetarli emas. Sizda: ${user.stars.toFixed(0)}, kerak: ${starsPrice}` });
    db.db.prepare('UPDATE users SET stars=stars-? WHERE telegram_id=?').run(starsPrice, user.telegram_id);
  } else if (pay_with === 'uzs') {
    const uzsPrice = price * cfg.RM_TO_UZS;
    if (user.uzs < uzsPrice) return res.status(400).json({ error: `UZS yetarli emas. Sizda: ${user.uzs.toFixed(0)}, kerak: ${uzsPrice}` });
    db.db.prepare('UPDATE users SET uzs=uzs-? WHERE telegram_id=?').run(uzsPrice, user.telegram_id);
  }
  
  const orderId = db.createOrder({
    user_id: user.id, gift_id: gift.id,
    target_telegram_id: target_telegram_id || null,
    target_username: target_username || null,
    amount_rm: price, pay_with,
    anonymous: anonymous ? 1 : 0,
    comment: comment || null, promo_code: promo_code || null,
    status: 'pending',
  });
  
  // Gift yuborish
  const account = db.getActiveAccount();
  const targetId = target_telegram_id || user.telegram_id;
  
  const result = await sendGift({
    sessionString: account?.session_string,
    toUserId: targetId,
    tgGiftId: parseInt(gift.tg_gift_id),
    anonymous, message: comment,
  });
  
  if (result.ok) {
    db.updateOrder(orderId, 'success');
    if (account) db.accountGiftSent(account.id);
    if (gift.stock > 0) db.db.prepare('UPDATE gifts SET stock=stock-1 WHERE id=?').run(gift.id);
    db.db.prepare('UPDATE users SET purchases_count=purchases_count+1 WHERE telegram_id=?').run(user.telegram_id);
    
    // Referral mukofot (birinchi xarid)
    if (user.referred_by && user.purchases_count === 0) {
      const inviter = db.getUser(user.referred_by);
      if (inviter) {
        const reward = price * 0.01; // 1%
        db.addRmCoins(inviter.telegram_id, reward);
        db.db.prepare('UPDATE referrals SET reward_rm=reward_rm+? WHERE invited_id=?').run(reward, user.id);
      }
    }
    
    return res.json({ ok: true, order_id: orderId, status: 'success' });
  } else {
    // Pulni qaytarish
    if (pay_with === 'rm') db.db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(price, user.telegram_id);
    else if (pay_with === 'stars') db.db.prepare('UPDATE users SET stars=stars+? WHERE telegram_id=?').run(price * cfg.RM_TO_STARS, user.telegram_id);
    else db.db.prepare('UPDATE users SET uzs=uzs+? WHERE telegram_id=?').run(price * cfg.RM_TO_UZS, user.telegram_id);
    
    db.updateOrder(orderId, 'failed', result.error);
    const friendlyErr = {
      user_not_started: 'Foydalanuvchi bot bilan chat ochmagan.',
      balance_low: 'Hisobda Stars yetarli emas. Admin bilan bog\'laning.',
      flood: 'Flood wait. Bir oz kuting.',
      sold_out: 'Gift turib ketdi.',
    }[result.errorType] || result.error;
    return res.status(400).json({ error: friendlyErr });
  }
});

router.get('/orders/my', authUser, (req, res) => {
  const user = db.getUser(req.tgUser.id);
  if (!user) return res.json([]);
  res.json(db.getUserOrders(user.id));
});

router.get('/orders/admin/all', authAdmin, (req, res) => {
  res.json(db.getAllOrders(req.query.status));
});

// ═══════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════

router.get('/inventory', authUser, (req, res) => {
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  res.json(db.getUserInventory(user.id));
});

router.post('/inventory/:id/sell', authUser, (req, res) => {
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const itemId = parseInt(req.params.id);
  const item = db.db.prepare('SELECT * FROM inventory WHERE id=? AND user_id=?').get(itemId, user.id);
  
  if (!item || item.is_sold) return res.status(404).json({ error: 'Item topilmadi yoki allaqachon sotilgan' });
  
  // Sotish narxi (masalan, qiymatining 80% yoki fix narx)
  let sellPrice = parseFloat(item.item_value) * 0.8; 
  if (isNaN(sellPrice)) sellPrice = 1; // Default
  
  const ok = db.sellInventoryItem(user.id, itemId, sellPrice);
  if (ok) {
    res.json({ ok: true, win: sellPrice, new_balance: db.getUser(user.telegram_id).rm_coins });
  } else {
    res.status(400).json({ error: 'Sotishda xato' });
  }
});

router.post('/inventory/:id/withdraw', authUser, (req, res) => {
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const itemId = parseInt(req.params.id);
  db.db.prepare('UPDATE inventory SET is_withdrawn=1 WHERE id=? AND user_id=?').run(itemId, user.id);
  res.json({ ok: true, message: 'Yechib olish so\'rovi yuborildi. Admin tez orada bog\'lanadi.' });
});

// ═══════════════════════════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════════════════════════

router.get('/admin/promo', authAdmin, (req, res) => {
  res.json(db.getAllPromos());
});

router.post('/admin/promo', authAdmin, (req, res) => {
  const { code, discount_type = 'percent', discount_value, max_uses = 100, expires_at } = req.body;
  if (!code || discount_value === undefined) return res.status(400).json({ error: 'code va discount_value kerak' });
  try {
    const p = db.createPromo({ code: code.toUpperCase().trim(), discount_type, discount_value, max_uses, expires_at: expires_at || null });
    res.json(p);
  } catch (e) {
    res.status(400).json({ error: 'Bu kod allaqachon mavjud' });
  }
});

router.delete('/admin/promo/:id', authAdmin, (req, res) => {
  db.deletePromo(parseInt(req.params.id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
// ACCOUNTS (Telethon → Bot API)
// ═══════════════════════════════════════════════════════════════════

router.get('/accounts', authAdmin, (req, res) => {
  res.json(db.getAccounts());
});

router.post('/accounts/manual', authAdmin, (req, res) => {
  const { phone, session_string, note } = req.body;
  if (!phone || !session_string) return res.status(400).json({ error: 'phone va session_string kerak' });
  db.upsertAccount(phone, { session: session_string, username: note || null, first_name: null, tg_id: null });
  res.json({ ok: true });
});

router.patch('/accounts/:id/toggle', authAdmin, (req, res) => {
  const acc = db.toggleAccount(parseInt(req.params.id));
  if (!acc) return res.status(404).json({ error: 'Account topilmadi' });
  res.json({ ok: true, is_active: acc.is_active });
});

router.delete('/accounts/:id', authAdmin, (req, res) => {
  db.deleteAccount(parseInt(req.params.id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
// CASES
// ═══════════════════════════════════════════════════════════════════

router.get('/cases', authUser, (req, res) => {
  res.json(db.getCases(false));
});

router.get('/cases/admin/all', authAdmin, (req, res) => {
  res.json(db.getCases(true));
});

router.post('/cases/admin', authAdmin, upload.single('image'), (req, res) => {
  const { name, price_rm, is_limited, total_supply } = req.body;
  let prizes = [];
  try { prizes = JSON.parse(req.body.prizes || '[]'); } catch {}
  
  if (!name || !price_rm || prizes.length === 0) {
    return res.status(400).json({ error: 'name, price_rm va prizes kerak' });
  }
  // Chance avtomatik hisoblash (agar berilmagan bo'lsa)
  const totalChance = prizes.reduce((s, p) => s + (parseFloat(p.chance) || 0), 0);
  if (Math.abs(totalChance - 100) > 0.1) {
    return res.status(400).json({ error: 'Prizes chance lar yig\'indisi 100% bo\'lishi kerak' });
  }
  
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url || null;
  const c = db.createCase(
    { name, image_url, price_rm: parseInt(price_rm), is_limited: is_limited ? 1 : 0, total_supply: parseInt(total_supply || -1) },
    prizes
  );
  res.json(c);
});

router.delete('/cases/admin/:id', authAdmin, (req, res) => {
  db.deleteCase(parseInt(req.params.id));
  res.json({ ok: true });
});

router.post('/cases/:id/open', authUser, (req, res) => {
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const c = db.getCase(parseInt(req.params.id));
  if (!c || !c.is_active) return res.status(404).json({ error: 'Case topilmadi' });
  
  // Limited tekshirish
  if (c.is_limited && c.total_supply > 0 && c.opened_count >= c.total_supply) {
    return res.status(400).json({ error: 'Case tugagan (Limited edition)' });
  }
  
  // To'lov
  if (user.rm_coins < c.price_rm) {
    return res.status(400).json({ error: `RM Coin yetarli emas. Sizda: ${user.rm_coins.toFixed(0)}, kerak: ${c.price_rm}` });
  }
  db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE id=?').run(c.price_rm, user.id);
  
  const result = db.openCase(user.id, c.id);
  if (!result) return res.status(500).json({ error: 'Case ochishda xato' });
  
  // Mukofot berish
  const prize = result.prize;
  if (prize.type === 'rm') {
    db.addRmCoins(user.telegram_id, parseFloat(prize.value));
  } else if (prize.type === 'stars') {
    db.db.prepare('UPDATE users SET stars=stars+? WHERE telegram_id=?').run(parseFloat(prize.value), user.telegram_id);
  }
  // 'gift' va 'nft' turlari — admin tomonidan qo'lda beriladi
  
  res.json({
    ok: true,
    prize: { ...prize, delivered: prize.type === 'rm' || prize.type === 'stars' },
    new_rm_coins: db.getUser(user.telegram_id)?.rm_coins,
  });
});

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS (pul kiritish)
// ═══════════════════════════════════════════════════════════════════

router.post('/payments/stars/callback', (req, res) => {
  // Telegram Stars (XTR) callback handler
  // Bu yerda Telegram Stars to'lovi muvaffaqiyatli bo'lganda user balansini yangilash kerak
  const { user_id, amount_stars, payload } = req.body;
  const user = db.getUser(user_id);
  if (user) {
    db.db.prepare('UPDATE users SET stars=stars+? WHERE telegram_id=?').run(amount_stars, user_id);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'User topilmadi' });
  }
});

router.post('/payments/request', authUser, upload.single('screenshot'), (req, res) => {
  const { amount_uzs } = req.body;
  if (!amount_uzs || parseFloat(amount_uzs) < 1000) {
    return res.status(400).json({ error: 'Minimal to\'lov 1000 so\'m' });
  }
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const amtUzs = parseFloat(amount_uzs);
  const amtRm = amtUzs / cfg.RM_TO_UZS;
  const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;
  
  const id = db.createPaymentRequest(user.id, amtUzs, amtRm, screenshotPath);
  res.json({ ok: true, payment_id: id, amount_rm: amtRm, card_number: cfg.CARD_NUMBER, card_holder: cfg.CARD_HOLDER });
});

router.get('/payments/admin/all', authAdmin, (req, res) => {
  res.json(db.getPaymentRequests(req.query.status));
});

router.post('/payments/admin/:id/approve', authAdmin, (req, res) => {
  const pmt = db.updatePayment(parseInt(req.params.id), 'approved', req.body.note);
  if (!pmt) return res.status(404).json({ error: 'To\'lov topilmadi' });
  
  // User ga RM qo'shish
  const user = db.getUserById(pmt.user_id);
  if (user) db.addRmCoins(user.telegram_id, pmt.amount_rm);
  
  res.json({ ok: true });
});

router.post('/payments/admin/:id/reject', authAdmin, (req, res) => {
  db.updatePayment(parseInt(req.params.id), 'rejected', req.body.note);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
// CHANNELS (majburiy kanallar)
// ═══════════════════════════════════════════════════════════════════

router.get('/channels', authAdmin, (req, res) => {
  res.json(db.getChannels());
});

router.post('/channels', authAdmin, (req, res) => {
  const { channel_id, channel_name } = req.body;
  if (!channel_id) return res.status(400).json({ error: 'channel_id kerak' });
  db.addChannel(channel_id, channel_name || channel_id);
  res.json({ ok: true });
});

router.delete('/channels/:id', authAdmin, (req, res) => {
  db.removeChannel(parseInt(req.params.id));
  res.json({ ok: true });
});

// Kanalga a'zoligini tekshirish
router.get('/channels/check', authUser, async (req, res) => {
  const channels = db.getChannels();
  if (channels.length === 0) return res.json({ ok: true, channels: [] });
  
  const results = [];
  for (const ch of channels) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${cfg.BOT_TOKEN}/getChatMember?chat_id=${ch.channel_id}&user_id=${req.tgUser.id}`);
      const data = await r.json();
      const status = data.result?.status;
      results.push({ ...ch, is_member: ['member','administrator','creator'].includes(status) });
    } catch {
      results.push({ ...ch, is_member: false });
    }
  }
  const allOk = results.every(r => r.is_member);
  res.json({ ok: allOk, channels: results });
});

// ═══════════════════════════════════════════════════════════════════
// GAMES (Mines)
// ═══════════════════════════════════════════════════════════════════

const minesGames = new Map(); // Vaqtinchalik o'yin holati

router.post('/games/mines/start', authUser, (req, res) => {
  const { bet, bombs } = req.body;
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  
  if (user.rm_coins < bet) return res.status(400).json({ error: 'RM Coin yetarli emas' });
  if (bombs < 1 || bombs > 24) return res.status(400).json({ error: 'Bombalar soni 1-24 oraliqda bo\'lishi kerak' });
  
  db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE id=?').run(bet, user.id);
  
  // Bombalarni joylashtirish
  const minePositions = [];
  while (minePositions.length < bombs) {
    const pos = Math.floor(Math.random() * 25);
    if (!minePositions.includes(pos)) minePositions.push(pos);
  }
  
  const gameState = {
    userId: user.id,
    bet,
    bombs,
    minePositions,
    opened: [],
    status: 'active'
  };
  
  minesGames.set(user.id, gameState);
  res.json({ ok: true, state: { bombs, opened: [] } });
});

router.post('/games/mines/open', authUser, (req, res) => {
  const { index } = req.body;
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const game = minesGames.get(user.id);
  
  if (!game || game.status !== 'active') return res.status(400).json({ error: 'Faol o\'yin topilmadi' });
  if (game.opened.includes(index)) return res.status(400).json({ error: 'Bu katak allaqachon ochilgan' });
  
  game.opened.push(index);
  
  if (game.minePositions.includes(index)) {
    game.status = 'lost';
    db.saveGameHistory(user.id, 'mines', game.bet, 0, 0, 'lost');
    const mines = game.minePositions;
    minesGames.delete(user.id);
    return res.json({ ok: true, type: 'mine', mines });
  } else {
    const mult = calculateMinesMult(game.bombs, game.opened.length);
    res.json({ ok: true, type: 'gem', mult });
  }
});

router.post('/games/mines/cashout', authUser, (req, res) => {
  const { user } = db.getOrCreateUser(req.tgUser.id, req.tgUser.username, req.tgUser.first_name);
  const game = minesGames.get(user.id);
  
  if (!game || game.status !== 'active' || game.opened.length === 0) {
    return res.status(400).json({ error: 'Cashout qilish imkonsiz' });
  }
  
  const mult = calculateMinesMult(game.bombs, game.opened.length);
  const win = game.bet * mult;
  
  db.addRmCoins(user.telegram_id, win);
  db.saveGameHistory(user.id, 'mines', game.bet, mult, win, 'win');
  
  const mines = game.minePositions;
  minesGames.delete(user.id);
  
  res.json({ ok: true, win, new_balance: db.getUser(user.telegram_id).rm_coins, mines });
});

function calculateMinesMult(bombs, opened) {
  let mult = 1.0;
  for (let i = 0; i < opened; i++) {
    mult *= (25 - i) / (25 - i - bombs);
  }
  return Math.round(mult * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════

router.get('/admin/dashboard', authAdmin, (req, res) => {
  res.json(db.getDashboardStats());
});

router.get('/admin/referrals', authAdmin, (req, res) => {
  res.json(db.getReferralStats());
});

module.exports = router;
