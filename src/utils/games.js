// ========== MINES GAME ==========

export function calculateMinesResult(bombCount, revealedCount, multiplier) {
  // Simple calculation: if user hits a bomb, they lose
  // Otherwise, they win based on multiplier
  const isBomb = Math.random() < (bombCount / (25 - revealedCount));
  return { isBomb, multiplier: isBomb ? 0 : multiplier };
}

export function calculateMinesMultiplier(safeReveals, totalTiles = 25, bombCount) {
  // Multiplier increases with each safe reveal
  // Formula: 1 + (safeReveals / (totalTiles - bombCount)) * 2
  const maxSafe = totalTiles - bombCount;
  return 1 + (safeReveals / maxSafe) * 2;
}

// ========== SLOTS GAME ==========

export function calculateSlotsResult(bet) {
  // Generate 3 random numbers (1-7)
  const reels = [
    Math.floor(Math.random() * 7) + 1,
    Math.floor(Math.random() * 7) + 1,
    Math.floor(Math.random() * 7) + 1,
  ];

  let multiplier = 0;

  // All three match
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = 5;
  }
  // Two match
  else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = 2;
  }
  // No match
  else {
    multiplier = 0;
  }

  const winAmount = bet * multiplier;
  return { reels, multiplier, winAmount };
}

// ========== COIN FLIP GAME ==========

export function calculateCoinFlipResult(bet, userChoice) {
  // userChoice: 'heads' or 'tails'
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const isWin = result === userChoice;
  const multiplier = isWin ? 2 : 0;
  const winAmount = bet * multiplier;

  return { result, isWin, multiplier, winAmount };
}

// ========== DICE GAME ==========

export function calculateDiceResult(bet, userGuess) {
  // userGuess: number 1-6
  const roll = Math.floor(Math.random() * 6) + 1;
  const isWin = roll === userGuess;
  const multiplier = isWin ? 6 : 0;
  const winAmount = bet * multiplier;

  return { roll, isWin, multiplier, winAmount };
}

// ========== CASE OPENING ==========

export function selectCaseReward(rewards) {
  // Select a reward based on drop chance
  const totalChance = rewards.reduce((sum, r) => sum + r.drop_chance, 0);
  let random = Math.random() * totalChance;

  for (const reward of rewards) {
    random -= reward.drop_chance;
    if (random <= 0) {
      return reward;
    }
  }

  return rewards[0];
}

// ========== CURRENCY CONVERSION ==========

const RM_COIN_TO_STARS = 1;
const RM_COIN_TO_UZS = 150;
const STARS_TO_UZS = 150;

export function convertRmCoinsToStars(rmCoins) {
  return rmCoins * RM_COIN_TO_STARS;
}

export function convertRmCoinsToUzs(rmCoins) {
  return rmCoins * RM_COIN_TO_UZS;
}

export function convertStarsToRmCoins(stars) {
  return stars / RM_COIN_TO_STARS;
}

export function convertStarsToUzs(stars) {
  return stars * STARS_TO_UZS;
}

export function convertUzsToRmCoins(uzs) {
  return uzs / RM_COIN_TO_UZS;
}

export function convertUzsToStars(uzs) {
  return uzs / STARS_TO_UZS;
}

// ========== REFERRAL REWARDS ==========

export function calculateReferralReward(giftPrice) {
  // 1% of gift price as referral reward
  return giftPrice * 0.01;
}

export function calculateReferralBonus(referralCount) {
  // Bonus stars for referrals
  // 1 referral = 1 star, 5 referrals = 5 stars, etc.
  return referralCount;
}
