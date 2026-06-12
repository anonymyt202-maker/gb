/**
 * bot.js
 * Telegraf bot — barcha handlers:
 * - start, balance, referral, games (Python: bot/handlers/start.py, games.py, support.py)
 * - keyboards (Python: bot/keyboards/main.py)
 * - Mines va boshqa o'yinlar (yangi)
 */

const { Telegraf, Markup, session } = require('telegraf');
const cfg = require('./config');
const db = require('./database');

const bot = new Telegraf(cfg.BOT_TOKEN);
bot.use(session());

// ─── Keyboards ────────────────────────────────────────────────────
const mainMenuKb = () => Markup.inlineKeyboard([
  [Markup.button.webApp('🎁 Gift Shop', `${cfg.API_BASE_URL}/webapp/user`)],
  [Markup.button.callback('👤 Hisobim', 'balance'), Markup.button.callback('👥 Do\'stlar', 'referral')],
  [Markup.button.callback('🎮 O\'yinlar', 'games'), Markup.button.callback('📩 Yordam', 'support')],
  [Markup.button.callback('💳 Pul kiritish', 'deposit'), Markup.button.callback('🔄 Konvertatsiya', 'convert')],
]);

const gamesKb = () => Markup.inlineKeyboard([
  [Markup.button.callback('🎲 Zar', 'game_dice'),      Markup.button.callback('⚽ Futbol', 'game_football')],
  [Markup.button.callback('🏀 Basketbol', 'game_basketball'), Markup.button.callback('🎯 Darts', 'game_darts')],
  [Markup.button.callback('🎰 Slotlar', 'game_slots'), Markup.button.callback('🪙 Coin Flip', 'game_coin')],
  [Markup.button.callback('💣 Mines', 'game_mines'),   Markup.button.callback('🎁 Kunlik Bonus', 'daily')],
  [Markup.button.callback('⬅️ Orqaga', 'main')],
]);

const betKb = (game) => Markup.inlineKeyboard([
  [Markup.button.callback('1 🪙', `bet_${game}_1`),   Markup.button.callback('5 🪙', `bet_${game}_5`),   Markup.button.callback('10 🪙', `bet_${game}_10`)],
  [Markup.button.callback('25 🪙', `bet_${game}_25`), Markup.button.callback('50 🪙', `bet_${game}_50`), Markup.button.callback('100 🪙', `bet_${game}_100`)],
  [Markup.button.callback('✏️ Boshqa miqdor', `bet_${game}_custom`)],
  [Markup.button.callback('⬅️ O\'yinlarga', 'games')],
]);

const minesBombKb = (bombs) => Markup.inlineKeyboard([
  [Markup.button.callback('1 💣', `mines_bomb_1_${bombs}`), Markup.button.callback('3 💣', `mines_bomb_3_${bombs}`), Markup.button.callback('5 💣', `mines_bomb_5_${bombs}`)],
  [Markup.button.callback('⬅️ Orqaga', 'game_mines_menu')],
]);

const backKb = (cb = 'main') => Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', cb)]]);

// ─── Game logic ───────────────────────────────────────────────────
const GAME_INFO = {
  dice:       { name: '🎲 Zar',       emoji: '🎲' },
  football:   { name: '⚽ Futbol',    emoji: '⚽' },
  basketball: { name: '🏀 Basketbol', emoji: '🏀' },
  darts:      { name: '🎯 Darts',     emoji: '🎯' },
  slots:      { name: '🎰 Slotlar',   emoji: '🎰' },
  coin:       { name: '🪙 Coin Flip', emoji: '🎲' },
};

function calcResult(game, value, bet) {
  if (game === 'dice') {
    if (value === 6) return { win: bet * 2,    text: '🎉 6 tushdi! 2×!', mult: 2 };
    if (value === 5) return { win: bet * 1.5,  text: '🎊 5 tushdi! 1.5×!', mult: 1.5 };
    if (value === 4) return { win: bet,        text: '🙂 4 tushdi. Qaytarildi.', mult: 1 };
    if (value === 3) return { win: bet * 0.5,  text: '😕 3 tushdi. Yarmi.', mult: 0.5 };
    return { win: 0, text: `😢 ${value} tushdi. Yutqazdingiz!`, mult: 0 };
  }
  if (game === 'football')   return value >= 3 ? { win: bet * 1.44, text: '⚽ GOL! 1.44×!', mult: 1.44 } : { win: 0, text: '❌ Xato!', mult: 0 };
  if (game === 'basketball') return value >= 4 ? { win: bet * 1.5,  text: '🏀 HIT! 1.5×!', mult: 1.5 }  : { win: 0, text: '❌ Xato!', mult: 0 };
  if (game === 'darts') {
    if (value === 6) return { win: bet * 2,   text: '🎯 MARKAZ! 2×!', mult: 2 };
    if (value >= 4)  return { win: bet * 1.5, text: '🎯 Yaqin! 1.5×!', mult: 1.5 };
    return { win: 0, text: '❌ Xato!', mult: 0 };
  }
  if (game === 'slots') {
    const THREE_SAME = new Set([1, 22, 43, 64]);
    if (value === 64) return { win: bet * 5, text: '🎰 777 JACKPOT! 5×! 🎉', mult: 5 };
    if (value === 1)  return { win: bet * 2, text: '🍋🍋🍋 2×!', mult: 2 };
    if (THREE_SAME.has(value)) return { win: bet * 2, text: '🎰 3 bir xil! 2×!', mult: 2 };
    return { win: 0, text: '❌ Yutqazdingiz.', mult: 0 };
  }
  if (game === 'coin') {
    const won = Math.random() > 0.5;
    return won ? { win: bet * 1.9, text: '🪙 Yutdingiz! 1.9×!', mult: 1.9 } : { win: 0, text: '🪙 Yutqazdingiz!', mult: 0 };
  }
  return { win: 0, text: '?', mult: 0 };
}

// ─── START ────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const payload = ctx.startPayload || '';
  const tgUser = ctx.from;
  const { user, isNew } = db.getOrCreateUser(tgUser.id, tgUser.username, tgUser.first_name);

  // Referral
  if (payload.startsWith('ref_') && isNew) {
    const refCode = payload.slice(4);
    const inviter = db.getUserByRefCode(refCode);
    if (inviter && inviter.telegram_id !== tgUser.id) {
      db.db.prepare('UPDATE users SET referred_by=? WHERE telegram_id=?').run(inviter.telegram_id, tgUser.id);
      db.addReferral(inviter.id, user.id, cfg.REFERRAL_REWARD);
      try {
        await ctx.telegram.sendMessage(inviter.telegram_id,
          `🎉 Yangi referal! <b>+${cfg.REFERRAL_REWARD} 🪙 RM Coin</b> oldingiz!\n👤 ${tgUser.first_name || tgUser.username || 'Yangi foydalanuvchi'} sizning havolangiz orqali qo'shildi.`,
          { parse_mode: 'HTML' });
      } catch {}
    }
  }

  if (isNew) {
    for (const adminId of cfg.ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId,
          `👤 <b>Yangi foydalanuvchi!</b>\n\n🆔 <code>${tgUser.id}</code>\n📛 @${tgUser.username || '—'}\nIsm: ${tgUser.first_name || '—'}`,
          { parse_mode: 'HTML' });
      } catch {}
    }
  }

  const u = db.getUser(tgUser.id);
  await ctx.replyWithHTML(
    `🎁 <b>RM Gift Bot</b> ga xush kelibsiz!\n\n` +
    `💼 <b>Hisobingiz:</b>\n` +
    `   🪙 RM Coin: <b>${(u.rm_coins || 0).toFixed(2)}</b>\n` +
    `   ⭐ Stars: <b>${(u.stars || 0).toFixed(0)}</b>\n` +
    `   💵 UZS: <b>${(u.uzs || 0).toLocaleString()}</b>\n\n` +
    `1 🪙 RM Coin = ${cfg.RM_TO_STARS} ⭐ Stars = ${cfg.RM_TO_UZS} so'm`,
    mainMenuKb()
  );
});

// ─── ADMIN ────────────────────────────────────────────────────────
bot.command('admin', async (ctx) => {
  if (!cfg.ADMIN_IDS.includes(ctx.from.id)) return;
  await ctx.replyWithHTML('🔧 <b>Admin Panel</b>', Markup.inlineKeyboard([
    [Markup.button.webApp('🔧 Admin Panelni Ochish', `${cfg.API_BASE_URL}/webapp/admin`)]
  ]));
});

// ─── MAIN CALLBACK ────────────────────────────────────────────────
bot.action('main', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  await ctx.editMessageText(
    `🎁 <b>RM Gift Bot</b>\n\n🪙 RM Coin: <b>${(u?.rm_coins || 0).toFixed(2)}</b>\n⭐ Stars: <b>${(u?.stars || 0).toFixed(0)}</b>\n💵 UZS: <b>${(u?.uzs || 0).toLocaleString()}</b>`,
    { parse_mode: 'HTML', reply_markup: mainMenuKb().reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── BALANCE ──────────────────────────────────────────────────────
bot.action('balance', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  const refCount = db.db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(u?.id)?.c || 0;
  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${u?.referral_code}`;

  await ctx.editMessageText(
    `👤 <b>Hisobim</b>\n\n` +
    `🆔 ID: <code>${ctx.from.id}</code>\n` +
    `🪙 RM Coin: <b>${(u?.rm_coins || 0).toFixed(2)}</b>\n` +
    `⭐ Stars: <b>${(u?.stars || 0).toFixed(0)}</b>\n` +
    `💵 UZS: <b>${(u?.uzs || 0).toLocaleString()}</b>\n` +
    `👥 Do'stlar: <b>${refCount}</b>\n` +
    `🛍 Xaridlar: <b>${u?.purchases_count || 0}</b>\n\n` +
    `🔗 Referal link:\n<code>${refLink}</code>`,
    { parse_mode: 'HTML', reply_markup: backKb('main').reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── REFERRAL ─────────────────────────────────────────────────────
bot.action('referral', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  const refCount = db.db.prepare('SELECT COUNT(*) as c FROM referrals WHERE inviter_id=?').get(u?.id)?.c || 0;
  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${u?.referral_code}`;

  await ctx.editMessageText(
    `👥 <b>Do'stlar tizimi</b>\n\n` +
    `🪙 Har do'st uchun: <b>${cfg.REFERRAL_REWARD} RM Coin</b>\n` +
    `🛍 Do'stingiz gift sotib olganda: <b>1% RM Coin</b>\n` +
    `👥 Jalb qildingan: <b>${refCount} kishi</b>\n\n` +
    `🔗 Sizning havolangiz:\n<code>${refLink}</code>\n\n` +
    `Havolani do'stlaringizga yuboring va mukofot oling!`,
    { parse_mode: 'HTML', reply_markup: backKb('main').reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── DEPOSIT ──────────────────────────────────────────────────────
bot.action('deposit', async (ctx) => {
  await ctx.editMessageText(
    `💳 <b>Hisob to'ldirish</b>\n\n` +
    `<b>Kurs:</b> 1 🪙 RM Coin = ${cfg.RM_TO_UZS} so'm\n\n` +
    `<b>Karta raqami:</b>\n<code>${cfg.CARD_NUMBER}</code>\n` +
    `<b>Karta egasi:</b> ${cfg.CARD_HOLDER}\n\n` +
    `📱 WebApp orqali pul kiritish uchun Gift Shop ni oching!`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard([
      [Markup.button.webApp('💳 Pul Kiritish', `${cfg.API_BASE_URL}/webapp/user`)],
      [Markup.button.callback('⬅️ Orqaga', 'main')],
    ]).reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── CONVERT ──────────────────────────────────────────────────────
bot.action('convert', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  await ctx.editMessageText(
    `🔄 <b>Konvertatsiya</b>\n\n` +
    `🪙 RM Coin: <b>${(u?.rm_coins || 0).toFixed(2)}</b>\n\n` +
    `Kurslar:\n` +
    `1 🪙 RM = ${cfg.RM_TO_STARS} ⭐ Stars\n` +
    `1 🪙 RM = ${cfg.RM_TO_UZS} 💵 so'm\n\n` +
    `WebApp orqali konvertatsiya qiling:`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard([
      [Markup.button.webApp('🔄 Konvertatsiya', `${cfg.API_BASE_URL}/webapp/user`)],
      [Markup.button.callback('⬅️ Orqaga', 'main')],
    ]).reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── GAMES ────────────────────────────────────────────────────────
bot.action('games', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  await ctx.editMessageText(
    `🎮 <b>O'yinlar</b>\n\n🪙 RM Coin: <b>${(u?.rm_coins || 0).toFixed(2)}</b>\n\nO'yin tanlang:`,
    { parse_mode: 'HTML', reply_markup: gamesKb().reply_markup }
  );
  await ctx.answerCbQuery();
});

// Game select
bot.action(/^game_(?!mines)(.+)$/, async (ctx) => {
  const game = ctx.match[1];
  if (!GAME_INFO[game]) return ctx.answerCbQuery('Noto\'g\'ri o\'yin!');

  const u = db.getUser(ctx.from.id);
  const now = new Date();

  // Slotlar — kunlik
  if (game === 'slots' && u?.last_slots_at) {
    const diff = (now - new Date(u.last_slots_at)) / 1000 / 3600;
    if (diff < 24) {
      const rem = Math.ceil(24 - diff);
      await ctx.editMessageText(`⏰ <b>Slotlar kunlik!</b>\nKeyingi: <b>${rem} soat</b>`, { parse_mode: 'HTML', reply_markup: gamesKb().reply_markup });
      return ctx.answerCbQuery();
    }
  }

  const gi = GAME_INFO[game];
  const rules = {
    dice: '6→2× | 5→1.5× | 4→qaytarildi | 3→0.5× | 1-2→lost',
    football: '3-5→1.44× | 1-2→lost',
    basketball: '4-5→1.5× | 1-3→lost',
    darts: '6→2× | 4-5→1.5× | 1-3→lost',
    slots: '777→5× | 🍋→2× | 3bir→2× | lost (kunlik)',
    coin: '50% → 1.9× yoki lost',
  }[game] || '';

  await ctx.editMessageText(
    `${gi.name}\n\n📋 ${rules}\n\n🪙 RM Coin: ${(u?.rm_coins || 0).toFixed(2)}\n\nTikish miqdori (RM Coin):`,
    { parse_mode: 'HTML', reply_markup: betKb(game).reply_markup }
  );
  await ctx.answerCbQuery();
});

// Bet
bot.action(/^bet_(.+)_(.+)$/, async (ctx) => {
  const [, game, amtStr] = ctx.match;
  
  if (amtStr === 'custom') {
    ctx.session = ctx.session || {};
    ctx.session.waitingBet = game;
    await ctx.editMessageText('✏️ Tikish miqdorini yozing (RM Coin, raqam):', { reply_markup: backKb('games').reply_markup });
    return ctx.answerCbQuery();
  }

  const bet = parseFloat(amtStr);
  const tgId = ctx.from.id;
  const gi = GAME_INFO[game] || {};

  const u = db.getUser(tgId);
  if (!u || u.rm_coins < bet) {
    return ctx.answerCbQuery(`❌ RM Coin yetarli emas! Sizda: ${(u?.rm_coins || 0).toFixed(2)}`, true);
  }

  // Slots kunlik tekshirish
  if (game === 'slots') {
    db.db.prepare("UPDATE users SET last_slots_at=datetime('now') WHERE telegram_id=?").run(tgId);
  }

  // Pul olish
  db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE telegram_id=?').run(bet, tgId);

  await ctx.editMessageText(
    `🎮 <b>${gi.name || game}</b>\n💰 Tikish: ${bet.toFixed(2)} 🪙\n⏳ Natijani kuting...`,
    { parse_mode: 'HTML' }
  );

  // Dice yuborish
  let diceMsg;
  try {
    if (game === 'coin') {
      diceMsg = await ctx.telegram.sendDice(ctx.chat.id, { emoji: '🎲' });
    } else {
      diceMsg = await ctx.telegram.sendDice(ctx.chat.id, { emoji: gi.emoji || '🎲' });
    }
  } catch {
    diceMsg = { dice: { value: Math.ceil(Math.random() * 6) } };
  }

  await new Promise(r => setTimeout(r, 3500));

  const value = diceMsg.dice.value;
  const res = calcResult(game, value, bet);
  const win = Math.round(res.win * 100) / 100;

  if (win > 0) {
    db.db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(win, tgId);
  }
  db.saveGameHistory(u.id, game, bet, res.mult, win, res.text);

  const newBal = db.getUser(tgId)?.rm_coins || 0;
  const net = win - bet;

  await ctx.replyWithHTML(
    `🎮 <b>${gi.name || game} natijasi</b>\n\n` +
    `🎲 Qiymat: <b>${value}</b>\n${res.text}\n\n` +
    `💰 Tikish: ${bet.toFixed(2)} 🪙\n` +
    (win > 0 ? `🏆 Yutish: +${win.toFixed(2)} 🪙\n` : '') +
    `📊 O'zgarish: <b>${net >= 0 ? '+' : ''}${net.toFixed(2)} 🪙</b>\n` +
    `🪙 RM Coin: <b>${newBal.toFixed(2)}</b>`,
    gamesKb()
  );
  await ctx.answerCbQuery();
});

// Custom bet handler
bot.on('text', async (ctx) => {
  const sess = ctx.session || {};

  // Support message
  if (sess.waitingSupport) {
    const uid = ctx.from.id;
    const uname = ctx.from.username ? `@${ctx.from.username}` : String(uid);
    for (const adminId of cfg.ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId,
          `📨 <b>Foydalanuvchidan xabar</b>\n\n👤 ${uname} (<code>${uid}</code>)\n\n💬 ${ctx.message.text}\n\n<i>Javob: /reply_${uid} matn</i>`,
          { parse_mode: 'HTML' });
      } catch {}
    }
    delete ctx.session.waitingSupport;
    await ctx.replyWithHTML('✅ <b>Xabaringiz yuborildi!</b>', backKb('main'));
    return;
  }

  // Custom bet
  if (sess.waitingBet) {
    const game = sess.waitingBet;
    const bet = parseFloat(ctx.message.text);
    delete ctx.session.waitingBet;
    
    if (!bet || bet <= 0) return ctx.reply('❌ Noto\'g\'ri miqdor!');
    
    const u = db.getUser(ctx.from.id);
    if (!u || u.rm_coins < bet) {
      return ctx.reply(`❌ RM Coin yetarli emas! Sizda: ${(u?.rm_coins || 0).toFixed(2)}`);
    }
    
    db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE telegram_id=?').run(bet, ctx.from.id);
    
    const gi = GAME_INFO[game] || {};
    await ctx.replyWithHTML(`🎮 <b>${gi.name || game}</b>\n💰 Tikish: ${bet.toFixed(2)} 🪙\n⏳ Natijani kuting...`);
    
    let diceMsg;
    try {
      diceMsg = await ctx.telegram.sendDice(ctx.chat.id, { emoji: gi.emoji || '🎲' });
    } catch {
      diceMsg = { dice: { value: Math.ceil(Math.random() * 6) } };
    }
    
    await new Promise(r => setTimeout(r, 3500));
    const value = diceMsg.dice.value;
    const res = calcResult(game, value, bet);
    const win = Math.round(res.win * 100) / 100;
    
    if (win > 0) db.db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(win, ctx.from.id);
    db.saveGameHistory(u.id, game, bet, res.mult, win, res.text);
    
    const newBal = db.getUser(ctx.from.id)?.rm_coins || 0;
    await ctx.replyWithHTML(
      `🎮 <b>${gi.name || game} natijasi</b>\n\n🎲 Qiymat: <b>${value}</b>\n${res.text}\n\n` +
      `💰 Tikish: ${bet.toFixed(2)} 🪙\n` +
      (win > 0 ? `🏆 Yutish: +${win.toFixed(2)} 🪙\n` : '') +
      `📊 O'zgarish: <b>${(win - bet >= 0 ? '+' : '')}${(win - bet).toFixed(2)} 🪙</b>\n` +
      `🪙 RM Coin: <b>${newBal.toFixed(2)}</b>`,
      gamesKb()
    );
    return;
  }

  // Admin reply
  if (ctx.message.text.startsWith('/reply_') && cfg.ADMIN_IDS.includes(ctx.from.id)) {
    const parts = ctx.message.text.split(' ');
    const targetId = parseInt(parts[0].split('_')[1]);
    const replyText = parts.slice(1).join(' ');
    if (!replyText) return ctx.reply('❌ Javob matni kiriting: /reply_USER_ID matn');
    try {
      await ctx.telegram.sendMessage(targetId, `📩 <b>Admin javobi:</b>\n\n${replyText}`, { parse_mode: 'HTML' });
      await ctx.reply('✅ Javob yuborildi.');
    } catch (e) {
      await ctx.reply(`❌ Xato: ${e.message}`);
    }
    return;
  }
});

// ─── MINES GAME ───────────────────────────────────────────────────
bot.action('game_mines', async (ctx) => {
  const u = db.getUser(ctx.from.id);
  await ctx.editMessageText(
    `💣 <b>Mines</b>\n\n` +
    `🪙 RM Coin: <b>${(u?.rm_coins || 0).toFixed(2)}</b>\n\n` +
    `Tikish miqdorini tanlang:`,
    { parse_mode: 'HTML', reply_markup: betKb('mines').reply_markup }
  );
  await ctx.answerCbQuery();
});

// Mines bet → bomb tanlash
bot.action(/^bet_mines_(.+)$/, async (ctx) => {
  const amtStr = ctx.match[1];
  if (amtStr === 'custom') {
    ctx.session = ctx.session || {};
    ctx.session.waitingBet = 'mines';
    await ctx.editMessageText('✏️ Mines uchun tikish miqdorini yozing (RM Coin):', { reply_markup: backKb('games').reply_markup });
    return ctx.answerCbQuery();
  }
  
  ctx.session = ctx.session || {};
  ctx.session.minesBet = parseFloat(amtStr);
  
  await ctx.editMessageText(
    `💣 <b>Mines</b>\n💰 Tikish: ${amtStr} 🪙\n\nQancha bomba bo'lsin?`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('1 💣', `mines_start_${amtStr}_1`), Markup.button.callback('3 💣', `mines_start_${amtStr}_3`), Markup.button.callback('5 💣', `mines_start_${amtStr}_5`)],
      [Markup.button.callback('10 💣', `mines_start_${amtStr}_10`), Markup.button.callback('24 💣', `mines_start_${amtStr}_24`)],
      [Markup.button.callback('⬅️ Orqaga', 'game_mines')],
    ]).reply_markup }
  );
  await ctx.answerCbQuery();
});

// Mines start
bot.action(/^mines_start_(.+)_(\d+)$/, async (ctx) => {
  const bet = parseFloat(ctx.match[1]);
  const bombs = parseInt(ctx.match[2]);
  const tgId = ctx.from.id;
  const u = db.getUser(tgId);
  
  if (!u || u.rm_coins < bet) {
    return ctx.answerCbQuery(`❌ RM Coin yetarli emas! Sizda: ${(u?.rm_coins || 0).toFixed(2)}`, true);
  }
  
  const GRID = 25;
  const bombPositions = new Set();
  while (bombPositions.size < bombs) {
    bombPositions.add(Math.floor(Math.random() * GRID));
  }
  
  // Session ga o'yin holati saqlash
  ctx.session = ctx.session || {};
  ctx.session.mines = {
    bet, bombs,
    bombPos: [...bombPositions],
    revealed: [],
    active: true,
    tgId,
  };
  
  db.db.prepare('UPDATE users SET rm_coins=rm_coins-? WHERE telegram_id=?').run(bet, tgId);
  
  // 5x5 grid keyboard
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      row.push(Markup.button.callback('🟦', `mines_click_${idx}`));
    }
    rows.push(row);
  }
  rows.push([Markup.button.callback('💰 Pul yechish', 'mines_cashout'), Markup.button.callback('❌ Bekor', 'mines_cancel')]);
  
  const safe = GRID - bombs;
  await ctx.editMessageText(
    `💣 <b>Mines O'yini</b>\n\n` +
    `💰 Tikish: ${bet.toFixed(2)} 🪙\n💣 Bombalar: ${bombs}\n🟩 Xavfsiz: ${safe}\n\n` +
    `Xavfsiz katakchalarni oching! Pul yechish imkoniyatingiz bor.`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(rows).reply_markup }
  );
  await ctx.answerCbQuery();
});

// Mines click
bot.action(/^mines_click_(\d+)$/, async (ctx) => {
  const idx = parseInt(ctx.match[1]);
  const sess = ctx.session?.mines;
  
  if (!sess || !sess.active) return ctx.answerCbQuery('O\'yin tugagan!');
  if (sess.revealed.includes(idx)) return ctx.answerCbQuery('Bu allaqachon ochilgan!');
  
  sess.revealed.push(idx);
  
  if (sess.bombPos.includes(idx)) {
    // BOMB!
    sess.active = false;
    db.saveGameHistory(
      db.getUser(sess.tgId)?.id,
      'mines', sess.bet, 0, 0,
      `Bomba! ${sess.bombs} ta bomba, ${sess.revealed.length - 1} ta xavfsiz`
    );
    
    // Grid ko'rsatish
    const rows = [];
    for (let r = 0; r < 5; r++) {
      const row = [];
      for (let c = 0; c < 5; c++) {
        const i = r * 5 + c;
        if (sess.bombPos.includes(i)) row.push(Markup.button.callback('💣', 'noop'));
        else if (sess.revealed.includes(i)) row.push(Markup.button.callback('✅', 'noop'));
        else row.push(Markup.button.callback('⬜', 'noop'));
      }
      rows.push(row);
    }
    rows.push([Markup.button.callback('🔄 Qayta o\'ynash', 'game_mines'), Markup.button.callback('🎮 O\'yinlar', 'games')]);
    
    await ctx.editMessageText(
      `💣 <b>BOMBA! Yutqazdingiz!</b>\n\n` +
      `💸 Yo'qotildi: -${sess.bet.toFixed(2)} 🪙\n` +
      `✅ Ochilgan: ${sess.revealed.length - 1} ta xavfsiz katak\n\n` +
      `🪙 RM Coin: <b>${(db.getUser(sess.tgId)?.rm_coins || 0).toFixed(2)}</b>`,
      { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(rows).reply_markup }
    );
    await ctx.answerCbQuery('💣 Bomba!', true);
    return;
  }
  
  // Xavfsiz! Multiplier hisoblash
  const GRID = 25;
  const safeCount = sess.revealed.length;
  const totalSafe = GRID - sess.bombs;
  let mult = 1;
  for (let i = 0; i < safeCount; i++) {
    mult *= (GRID - sess.bombs - i) / (GRID - i);
  }
  mult = 1 / mult;
  mult = Math.max(1.01, Math.round(mult * 100) / 100);
  const winAmount = Math.round(sess.bet * mult * 100) / 100;
  
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      if (sess.revealed.includes(i)) row.push(Markup.button.callback('✅', 'noop'));
      else row.push(Markup.button.callback('🟦', `mines_click_${i}`));
    }
    rows.push(row);
  }
  rows.push([Markup.button.callback(`💰 Yechish (${winAmount.toFixed(2)} 🪙)`, 'mines_cashout'), Markup.button.callback('❌ Bekor', 'mines_cancel')]);
  
  sess.currentMult = mult;
  sess.currentWin = winAmount;
  
  await ctx.editMessageText(
    `💣 <b>Mines</b>\n\n` +
    `💰 Tikish: ${sess.bet.toFixed(2)} 🪙\n` +
    `✅ Ochilgan: ${safeCount} / ${totalSafe}\n` +
    `📈 Koeffitsient: <b>${mult.toFixed(2)}×</b>\n` +
    `💵 Yechish mumkin: <b>${winAmount.toFixed(2)} 🪙</b>`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(rows).reply_markup }
  );
  await ctx.answerCbQuery(`✅ Xavfsiz! ${mult.toFixed(2)}×`);
});

// Mines cashout
bot.action('mines_cashout', async (ctx) => {
  const sess = ctx.session?.mines;
  if (!sess || !sess.active) return ctx.answerCbQuery('O\'yin tugagan!');
  
  const win = sess.currentWin || sess.bet;
  const mult = sess.currentMult || 1;
  sess.active = false;
  
  db.db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(win, sess.tgId);
  db.saveGameHistory(db.getUser(sess.tgId)?.id, 'mines', sess.bet, mult, win, `Cashout: ${mult.toFixed(2)}×`);
  
  const newBal = db.getUser(sess.tgId)?.rm_coins || 0;
  await ctx.editMessageText(
    `💰 <b>Muvaffaqiyatli yechildi!</b>\n\n` +
    `💣 Bombalar: ${sess.bombs}\n` +
    `✅ Ochilgan: ${sess.revealed.length} katak\n` +
    `📈 Koeffitsient: <b>${mult.toFixed(2)}×</b>\n` +
    `🏆 Yutish: <b>+${win.toFixed(2)} 🪙</b>\n\n` +
    `🪙 RM Coin: <b>${newBal.toFixed(2)}</b>`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Qayta o\'ynash', 'game_mines')],
      [Markup.button.callback('🎮 O\'yinlar', 'games')],
    ]).reply_markup }
  );
  await ctx.answerCbQuery('💰 Pul yechildi!');
});

// Mines cancel
bot.action('mines_cancel', async (ctx) => {
  const sess = ctx.session?.mines;
  if (!sess || !sess.active) return ctx.answerCbQuery('O\'yin tugagan!');
  sess.active = false;
  // Pul qaytarish
  db.db.prepare('UPDATE users SET rm_coins=rm_coins+? WHERE telegram_id=?').run(sess.bet, sess.tgId);
  await ctx.editMessageText('❌ O\'yin bekor qilindi. Pul qaytarildi.', { reply_markup: gamesKb().reply_markup });
  await ctx.answerCbQuery();
});

bot.action('noop', (ctx) => ctx.answerCbQuery());

// ─── DAILY BONUS ──────────────────────────────────────────────────
bot.action('daily', async (ctx) => {
  const tgId = ctx.from.id;
  const u = db.getUser(tgId);
  if (!u) return;

  if (u.last_daily_bonus) {
    const diff = (Date.now() - new Date(u.last_daily_bonus).getTime()) / 1000 / 3600;
    if (diff < 24) {
      const rem = Math.ceil(24 - diff);
      await ctx.editMessageText(`⏰ <b>Bonus allaqachon olindi!</b>\nKeyingi: <b>${rem} soat</b>`, { parse_mode: 'HTML', reply_markup: gamesKb().reply_markup });
      return ctx.answerCbQuery();
    }
  }

  const bonus = Math.floor(Math.random() * 3) + 1;
  db.db.prepare("UPDATE users SET rm_coins=rm_coins+?,last_daily_bonus=datetime('now') WHERE telegram_id=?").run(bonus, tgId);
  const newBal = db.getUser(tgId)?.rm_coins || 0;

  await ctx.editMessageText(
    `🎁 <b>Kunlik bonus!</b>\n\n🪙 +${bonus} RM Coin\n🪙 RM Coin: <b>${newBal.toFixed(2)}</b>\n\nErtaga qaytib keling! 🌟`,
    { parse_mode: 'HTML', reply_markup: gamesKb().reply_markup }
  );
  await ctx.answerCbQuery();
});

// ─── SUPPORT ──────────────────────────────────────────────────────
bot.action('support', async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.waitingSupport = true;
  await ctx.editMessageText('📨 <b>Adminga xabar</b>\n\nXabaringizni yozing:', { parse_mode: 'HTML', reply_markup: backKb('main').reply_markup });
  await ctx.answerCbQuery();
});

module.exports = bot;
