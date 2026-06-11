import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { generateToken } from '../utils/auth.js';
import {
  getUserByTelegramId, createUser, getUserById, updateUserBalance, setUserBalance, getAllUsers, searchUsers,
  createGift, getGiftById, getAllGifts, getGiftsByCategory, updateGift, deleteGift,
  createCase, getCaseById, getAllCases, updateCase, deleteCase, addCaseReward, getCaseRewards,
  createOrder, getOrderById, getUserOrders, getAllOrders, updateOrderStatus,
  createGameSession, updateGameSession, getUserGameHistory,
  getReferralsByInviter, getReferralStats, getTopReferrers,
  createPromoCode, getPromoCodeByCode, getAllPromoCodes, updatePromoCode, incrementPromoCodeUsage, deletePromoCode,
  createCaseOpen, getUserCaseOpens,
} from '../db/queries.js';
import { calculateReferralReward, selectCaseReward } from '../utils/games.js';

const router = express.Router();

// ========== AUTH ROUTES ==========

router.post('/auth/login', async (req, res) => {
  try {
    const { telegramId, username, firstName } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    let user = await getUserByTelegramId(telegramId);
    if (!user) {
      user = await createUser(telegramId, username, firstName);
    }

    const token = generateToken(user.id);
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ========== USER ROUTES ==========

router.get('/users/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

router.get('/users/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/users/deposit', authMiddleware, async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'amount and currency are required' });
    }

    let rmCoins = 0, stars = 0, uzs = 0;

    if (currency === 'stars') {
      stars = amount;
      rmCoins = amount;
    } else if (currency === 'uzs') {
      uzs = amount;
      rmCoins = amount / 150;
    }

    const updated = await updateUserBalance(req.user.id, rmCoins, stars, uzs);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Deposit failed' });
  }
});

router.get('/users/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search } = req.query;

    let users;
    if (search) {
      users = await searchUsers(search);
    } else {
      users = await getAllUsers(100);
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.post('/users/admin/balance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { telegram_id, stars, uzs } = req.body;

    const user = await getUserByTelegramId(telegram_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let rmCoins = user.rm_coins;
    let newStars = user.stars;
    let newUzs = user.uzs;

    if (stars !== undefined && stars !== null) {
      newStars = stars;
      rmCoins = stars;
    }
    if (uzs !== undefined && uzs !== null) {
      newUzs = uzs;
      rmCoins = uzs / 150;
    }

    const updated = await setUserBalance(user.id, rmCoins, newStars, newUzs);
    res.json({ ok: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// ========== GIFT ROUTES ==========

router.get('/gifts', async (req, res) => {
  try {
    const gifts = await getAllGifts();
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get gifts' });
  }
});

router.get('/gifts/category/:category', async (req, res) => {
  try {
    const gifts = await getGiftsByCategory(req.params.category);
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get gifts' });
  }
});

router.post('/gifts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, imageUrl, priceRmCoins, category } = req.body;

    if (!name || !priceRmCoins) {
      return res.status(400).json({ error: 'name and priceRmCoins are required' });
    }

    const gift = await createGift(name, description, imageUrl, priceRmCoins, category);
    res.json(gift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create gift' });
  }
});

router.put('/gifts/:giftId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const gift = await updateGift(parseInt(req.params.giftId), req.body);
    res.json(gift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update gift' });
  }
});

router.delete('/gifts/:giftId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await deleteGift(parseInt(req.params.giftId));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete gift' });
  }
});

// ========== CASE ROUTES ==========

router.get('/cases', async (req, res) => {
  try {
    const cases = await getAllCases();
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cases' });
  }
});

router.post('/cases', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, imageUrl, priceRmCoins } = req.body;

    if (!name || !priceRmCoins) {
      return res.status(400).json({ error: 'name and priceRmCoins are required' });
    }

    const caseObj = await createCase(name, description, imageUrl, priceRmCoins);
    res.json(caseObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.put('/cases/:caseId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const caseObj = await updateCase(parseInt(req.params.caseId), req.body);
    res.json(caseObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

router.delete('/cases/:caseId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await deleteCase(parseInt(req.params.caseId));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

router.get('/cases/:caseId/rewards', async (req, res) => {
  try {
    const rewards = await getCaseRewards(parseInt(req.params.caseId));
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rewards' });
  }
});

router.post('/cases/:caseId/rewards', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rewardType, rewardValue, dropChance, stock } = req.body;

    if (!rewardType || !rewardValue || !dropChance) {
      return res.status(400).json({ error: 'rewardType, rewardValue, and dropChance are required' });
    }

    await addCaseReward(parseInt(req.params.caseId), rewardType, rewardValue, dropChance, stock);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add reward' });
  }
});

// ========== ORDER ROUTES ==========

router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await getUserOrders(req.user.id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

router.get('/orders/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

router.post('/orders', authMiddleware, async (req, res) => {
  try {
    const { giftId, targetTelegramId, targetUsername, anonymous, message } = req.body;

    const gift = await getGiftById(giftId);
    if (!gift) {
      return res.status(404).json({ error: 'Gift not found' });
    }

    if (req.user.rm_coins < gift.price_rm_coins) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await updateUserBalance(req.user.id, -gift.price_rm_coins, 0, 0);

    const order = await createOrder(
      req.user.id,
      giftId,
      targetTelegramId,
      targetUsername,
      gift.price_rm_coins,
      anonymous,
      message
    );

    if (req.user.referred_by) {
      const referrer = await getUserById(req.user.referred_by);
      if (referrer) {
        const reward = calculateReferralReward(gift.price_rm_coins);
        await updateUserBalance(referrer.id, reward, 0, 0);
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ========== GAME ROUTES ==========

router.post('/games/mines/start', authMiddleware, async (req, res) => {
  try {
    const { betAmount } = req.body;

    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    if (req.user.rm_coins < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await updateUserBalance(req.user.id, -betAmount, 0, 0);
    const session = await createGameSession(req.user.id, 'mines', betAmount);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game' });
  }
});

router.post('/games/slots/play', authMiddleware, async (req, res) => {
  try {
    const { betAmount } = req.body;

    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    if (req.user.rm_coins < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await updateUserBalance(req.user.id, -betAmount, 0, 0);

    const reels = [
      Math.floor(Math.random() * 7) + 1,
      Math.floor(Math.random() * 7) + 1,
      Math.floor(Math.random() * 7) + 1,
    ];

    let multiplier = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      multiplier = 5;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      multiplier = 2;
    }

    const winAmount = betAmount * multiplier;
    if (winAmount > 0) {
      await updateUserBalance(req.user.id, winAmount, 0, 0);
    }

    const session = await createGameSession(req.user.id, 'slots', betAmount);
    await updateGameSession(session.id, winAmount, multiplier, 'completed');

    res.json({ reels, multiplier, winAmount, session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to play game' });
  }
});

router.get('/games/history', authMiddleware, async (req, res) => {
  try {
    const { gameType } = req.query;
    const history = await getUserGameHistory(req.user.id, gameType);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ========== CASE OPEN ROUTES ==========

router.post('/cases/open', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.body;

    const caseObj = await getCaseById(caseId);
    if (!caseObj) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user.rm_coins < caseObj.price_rm_coins) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await updateUserBalance(req.user.id, -caseObj.price_rm_coins, 0, 0);

    const rewards = await getCaseRewards(caseId);
    const selectedReward = selectCaseReward(rewards);

    if (selectedReward.reward_type === 'rm_coins') {
      await updateUserBalance(req.user.id, selectedReward.reward_value, 0, 0);
    } else if (selectedReward.reward_type === 'stars') {
      await updateUserBalance(req.user.id, 0, selectedReward.reward_value, 0);
    }

    await createCaseOpen(req.user.id, caseId, selectedReward.reward_type, selectedReward.reward_value);

    res.json({ reward: selectedReward });
  } catch (error) {
    console.error('Case open error:', error);
    res.status(500).json({ error: 'Failed to open case' });
  }
});

router.get('/cases/opens', authMiddleware, async (req, res) => {
  try {
    const opens = await getUserCaseOpens(req.user.id);
    res.json(opens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get case opens' });
  }
});

// ========== PROMO CODE ROUTES ==========

router.post('/promo/validate', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const promo = await getPromoCodeByCode(code);
    if (!promo) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    if (promo.used_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Promo code limit reached' });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Promo code expired' });
    }

    await incrementPromoCodeUsage(promo.id);
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate promo' });
  }
});

router.get('/promo/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const promos = await getAllPromoCodes();
    res.json(promos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get promos' });
  }
});

router.post('/promo', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses, expiresAt } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'code, discountType, and discountValue are required' });
    }

    const promo = await createPromoCode(code, discountType, discountValue, maxUses, expiresAt);
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create promo' });
  }
});

router.delete('/promo/:promoId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await deletePromoCode(parseInt(req.params.promoId));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete promo' });
  }
});

// ========== REFERRAL ROUTES ==========

router.get('/referrals/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = await getReferralStats();
    const topReferrers = await getTopReferrers(10);
    res.json({ ...stats, top_inviters: topReferrers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/referrals/my', authMiddleware, async (req, res) => {
  try {
    const referrals = await getReferralsByInviter(req.user.id);
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

export default router;
