'use strict';

const main = () => ({ reply_markup: { inline_keyboard: [
  [{ text: '⭐ Stars sotib olish',   callback_data: 'mkt_buy_stars'  }, { text: '⭐ Stars sotish',      callback_data: 'mkt_sell_stars' }],
  [{ text: '💎 Premium',             callback_data: 'mkt_premium'    }, { text: '🔄 Stars → UZS',       callback_data: 'mkt_conv'       }],
  [{ text: '💰 TON sotib olish',     callback_data: 'mkt_buy_ton'   }, { text: '💸 TON sotish',         callback_data: 'mkt_sell_ton'   }],
  [{ text: '🎁 Gift do\'koni',       callback_data: 'buy_gift'      }, { text: '📦 Buyurtmalarim',      callback_data: 'my_orders'      }],
  [{ text: '👤 Profilim',            callback_data: 'profile'       }, { text: '🤖 Yordam / AI',        callback_data: 'ai_help'        }],
  [{ text: '👥 Referral',            callback_data: 'referral'      }],
]}}); 

const balance = () => ({ reply_markup: { inline_keyboard: [
  [{ text: '💵 Pul kiritish (UZS)',  callback_data: 'dep_uzs'         }],
  [{ text: '⭐ Stars kiritish',       callback_data: 'dep_stars'       }],
  [{ text: '🔄 Stars → UZS',         callback_data: 'mkt_conv'        }],
  [{ text: '⬅️ Bosh menyu',          callback_data: 'main'            }],
]}}); 

const back = (cb = 'main') => ({ reply_markup: { inline_keyboard: [
  [{ text: '⬅️ Orqaga', callback_data: cb }],
]}});

const confirm = (yesCb, noCb = 'main') => ({ reply_markup: { inline_keyboard: [
  [{ text: '🟩 Tasdiqlash', callback_data: yesCb }, { text: '🟥 Bekor', callback_data: noCb }],
]}});

const cancelOnly = (cb = 'main') => ({ reply_markup: { inline_keyboard: [
  [{ text: '🟥 Bekor qilish', callback_data: cb }],
]}});

module.exports = { main, balance, back, confirm, cancelOnly };
