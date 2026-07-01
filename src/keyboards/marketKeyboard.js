'use strict';

const buyStarsConfirm = (amount, price, cb = 'stars_buy_confirm') => ({ reply_markup: { inline_keyboard: [
  [{ text: `🟩 Tasdiqlash (${price} UZS)`, callback_data: cb }],
  [{ text: '🟥 Bekor', callback_data: 'main' }],
]}});

const sellStarsStep = () => ({ reply_markup: { inline_keyboard: [
  [{ text: '🟥 Bekor', callback_data: 'main' }],
]}});

const premiumPlans = (prices) => ({ reply_markup: { inline_keyboard: [
  [{ text: `💎 1 oy — ${prices[1]} ⭐`,  callback_data: 'prem_buy_1'  }],
  [{ text: `💎 3 oy — ${prices[3]} ⭐`,  callback_data: 'prem_buy_3'  }],
  [{ text: `💎 6 oy — ${prices[6]} ⭐`,  callback_data: 'prem_buy_6'  }],
  [{ text: `💎 12 oy — ${prices[12]} ⭐`, callback_data: 'prem_buy_12' }],
  [{ text: '⬅️ Orqaga', callback_data: 'main' }],
]}});

const tonMenu = () => ({ reply_markup: { inline_keyboard: [
  [{ text: '💰 TON sotib olish', callback_data: 'mkt_buy_ton'  }],
  [{ text: '💸 TON sotish',      callback_data: 'mkt_sell_ton' }],
  [{ text: '⬅️ Orqaga',         callback_data: 'main'         }],
]}});

const orderActions = (orderId, type = 'approve') => ({ reply_markup: { inline_keyboard: [
  [
    { text: '🟩 Tasdiqlash', callback_data: `adm_order_approve_${orderId}` },
    { text: '🟥 Rad etish',  callback_data: `adm_order_reject_${orderId}`  },
  ],
  [{ text: '📋 Batafsil', callback_data: `adm_order_view_${orderId}` }],
]}});

const backToMain = () => ({ reply_markup: { inline_keyboard: [
  [{ text: '⬅️ Bosh menyu', callback_data: 'main' }],
]}});

module.exports = { buyStarsConfirm, sellStarsStep, premiumPlans, tonMenu, orderActions, backToMain };
