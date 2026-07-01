'use strict';
require('dotenv').config();
const { Telegraf } = require('telegraf');
const cron         = require('node-cron');
const cfg          = require('./config');
const logger       = require('./utils/logger');
const jdb          = require('./database/json');
const sqlite       = require('./database/sqlite');
const gramjs       = require('./utils/gramjs');

// Handlers
const { handleStart }                           = require('./commands/start');
const { registerGiftHandlers, handleGiftStep }  = require('./handlers/giftHandler');
const { registerStarsHandlers, handleStarsStep } = require('./handlers/starsHandler');
const { registerPremiumHandlers, handlePremiumStep } = require('./handlers/premiumHandler');
const { registerTonHandlers, handleTonStep }    = require('./handlers/tonHandler');
const { registerConversionHandlers, handleConversionStep } = require('./handlers/conversionHandler');
const { registerDepositHandlers, sendStarsInvoice, handleUzsDeposit, handleUzsCheck, handleStarsPayment, handleSuccessfulPayment } = require('./handlers/depositHandler');
const { registerOrderHandlers }                 = require('./handlers/orderHandler');
const { registerAiHandlers, handleAiMessage }   = require('./handlers/aiHandler');

// Admin modules
const { registerAdminPanel }                    = require('./admin/adminPanel');
const { registerUsersAdmin, handleUserSearch }  = require('./admin/usersAdmin');
const { registerOrdersAdmin, handleRejectReason } = require('./admin/ordersAdmin');
const { registerStarsAdmin, handleStarsAdminStep } = require('./admin/starsAdmin');
const { registerPremiumAdmin, handlePremiumAdminStep } = require('./admin/premiumAdmin');
const { registerTonAdmin, handleTonAdminStep }  = require('./admin/tonAdmin');
const { registerReferralAdmin, handleReferralAdminStep } = require('./admin/referralAdmin');
const { registerApiAdmin, handleApiAdminStep }  = require('./admin/apiAdmin');
const { registerChannelsAdmin, handleChannelAdminStep, handleChannelRequired } = require('./admin/channelsAdmin');
const { registerSettingsAdmin, handleSettingsAdminStep } = require('./admin/settingsAdmin');
const { registerPermissionsAdmin, handlePermAdminStep } = require('./admin/permissionsAdmin');
const { registerBroadcastAdmin, handleBroadcastStep } = require('./admin/broadcastAdmin');
const { registerStatsAdmin }                    = require('./admin/statsAdmin');

// Keyboards
const mainKb = require('./keyboards/mainKeyboard');
const admKb  = require('./keyboards/adminKeyboard');

// Referral service
const refSvc = require('./services/referralService');

// ──────────── GLOBAL STATE ────────────
const ST = {};

// ──────────── BOT ────────────
const bot = new Telegraf(cfg.BOT_TOKEN, { handlerTimeout: 90_000 });

// ──────────── MIDDLEWARE ────────────
bot.use(async (ctx, next) => {
  if (ctx.from) {
    ctx.state.userId = ctx.from.id;
  }
  return next();
});

// ──────────── REGISTER ALL HANDLERS ────────────
registerAdminPanel(bot, ST);
registerUsersAdmin(bot, ST);
registerOrdersAdmin(bot, ST);
registerStarsAdmin(bot, ST);
registerPremiumAdmin(bot, ST);
registerTonAdmin(bot, ST);
registerReferralAdmin(bot, ST);
registerApiAdmin(bot, ST);
registerChannelsAdmin(bot, ST);
registerSettingsAdmin(bot, ST);
registerPermissionsAdmin(bot, ST);
registerBroadcastAdmin(bot, ST);
registerStatsAdmin(bot, ST);

registerGiftHandlers(bot, ST);
registerStarsHandlers(bot, ST);
registerPremiumHandlers(bot, ST);
registerTonHandlers(bot, ST);
registerConversionHandlers(bot, ST);
registerDepositHandlers(bot, ST);
registerOrderHandlers(bot, ST);
registerAiHandlers(bot, ST);

// ──────────── COMMANDS ────────────
bot.start(ctx => handleStart(ctx, ST));

bot.command('balance', async ctx => {
  const userId = ctx.from.id;
  const user   = await jdb.getUser(userId);
  if (!user) return ctx.reply('❌ Avval /start ni bosing.');
  await ctx.reply(
    `💼 <b>Balansingiz</b>\n\n⭐ Stars: <b>${user.stars}</b>\n💵 UZS: <b>${user.uzs?.toLocaleString('uz-UZ') || 0} so'm</b>\n🔒 Locked: ${user.lockedStars || 0} ⭐`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
});

bot.command('ref', async ctx => {
  const userId = ctx.from.id;
  const me = await bot.telegram.getMe();
  const link = `https://t.me/${me.username}?start=ref_${userId}`;
  const stats = sqlite.getReferralStats(userId);
  await ctx.reply(
    `👥 <b>Referral dasturi</b>\n\n🔗 Sizning havolangiz:\n<code>${link}</code>\n\n👤 Taklif qilganlar: ${stats.total}\n💰 Jami daromad: ${stats.earnings} ⭐`,
    { parse_mode: 'HTML' }
  );
});

// ──────────── CALLBACK QUERY: main menu ────────────
bot.action('main', async ctx => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const user   = await jdb.getUser(userId);
  const welcome = sqlite.getSetting('welcome_text') || 'Asosiy menyu:';
  await ctx.editMessageText(welcome, { parse_mode: 'HTML', ...mainKb.main(user) });
});

bot.action('check_join', async ctx => {
  await ctx.answerCbQuery('✅ Tekshirilmoqda...');
  await handleStart(ctx, ST);
});

bot.action('balance', async ctx => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const user   = await jdb.getUser(userId);
  if (!user) return ctx.editMessageText('❌ Avval /start ni bosing.', mainKb.back());
  await ctx.editMessageText(
    `💼 <b>Balansingiz</b>\n\n⭐ Stars: <b>${user.stars}</b>\n💵 UZS: <b>${(user.uzs || 0).toLocaleString('uz-UZ')} so'm</b>\n🔒 Locked Stars: ${user.lockedStars || 0} ⭐`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '⬅️ Asosiy menyu', callback_data: 'main' }],
    ]}}
  );
});

bot.action('referral', async ctx => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const me     = await bot.telegram.getMe();
  const link   = `https://t.me/${me.username}?start=ref_${userId}`;
  const stats  = sqlite.getReferralStats(userId);
  const bonus  = sqlite.getSettingNum('referral_start_bonus', 1);
  const lock   = sqlite.getSettingNum('referral_lock_days', 7);
  await ctx.editMessageText(
    `👥 <b>Referral dasturi</b>\n\n🎁 Har bir do'stingiz uchun: <b>${bonus} ⭐</b> (${lock} kunlik qulf)\n\n🔗 Sizning havolangiz:\n<code>${link}</code>\n\n👤 Taklif qilganlar: <b>${stats.total}</b>\n💰 Jami daromad: <b>${stats.earnings} ⭐</b>\n🔒 Qulflangan: <b>${stats.locked} ⭐</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🔓 Qulflangan mukofotlar', callback_data: 'ref_locked' }],
      [{ text: '⬅️ Asosiy menyu', callback_data: 'main' }],
    ]}}
  );
});

bot.action('ref_locked', async ctx => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const locked = sqlite.getLockedRewards(userId);
  if (!locked.length) return ctx.editMessageText('🔒 Qulflangan mukofotlar yo\'q.', mainKb.back());
  const lines = locked.map(l =>
    `🔒 ${l.stars} ⭐ — ${Math.ceil((new Date(l.unlockAt) - Date.now()) / 86400000)} kun qoldi`
  ).join('\n');
  await ctx.editMessageText(`🔒 <b>Qulflangan mukofotlar:</b>\n\n${lines}`, { parse_mode: 'HTML', ...mainKb.back() });
});

bot.action('help', async ctx => {
  await ctx.answerCbQuery();
  const rules = sqlite.getSetting('rules_text') ||
    `ℹ️ <b>Yordam</b>\n\n⭐ Stars — Telegram Stars sotib oling yoki soting\n💎 Premium — Telegram Premium xarid qiling\n💰 TON — TON kripto sotib oling yoki soting\n💳 Depozit — Hisobingizni to\'ldiring\n📦 Buyurtmalar — Buyurtmalaringizni kuzating\n👥 Referral — Do'stlarni taklif qilib bonus yig'ing\n\n📞 Muammo bo'lsa adminга murojaat qiling.`;
  await ctx.editMessageText(rules, { parse_mode: 'HTML', ...mainKb.back() });
});

bot.action('contact_admin', async ctx => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `📞 <b>Admin bilan bog'lanish</b>\n\nAdmin: @${cfg.ADMIN_USERNAME || 'admin'}\n\nSavol yoki muammolaringizni shu yerga yozing.`,
    { parse_mode: 'HTML', ...mainKb.back() }
  );
});

// Channel required toggle
bot.action(/^ch_req_([01])$/, async ctx => {
  await ctx.answerCbQuery();
  const adminId  = ctx.from.id;
  const required = ctx.match[1];
  await handleChannelRequired(ctx, adminId, required, ST, bot);
});

// ──────────── PRE-CHECKOUT & PAYMENT ────────────
bot.on('pre_checkout_query', ctx => handleStarsPayment(ctx, bot));
bot.on('successful_payment',  ctx => handleSuccessfulPayment(ctx, bot));

// ──────────── TEXT MESSAGE ROUTER ────────────
bot.on('text', async ctx => {
  const userId = ctx.from.id;
  const text   = ctx.message.text;
  const step   = ST[userId]?.step || '';
  const isAdmin = Number(userId) === cfg.ADMIN_ID || sqlite.isAdmin(userId);

  // Skip commands
  if (text.startsWith('/')) return;

  // ── User flows ──────────────────────────────────────
  if (step === 'uzs_amount') {
    const n = parseInt(text, 10);
    const minDep = sqlite.getSettingNum('min_uzs_deposit', 10000);
    const maxDep = sqlite.getSettingNum('max_uzs_deposit', 10000000);
    if (isNaN(n) || n < minDep || n > maxDep) return ctx.reply(`❌ ${minDep.toLocaleString()} – ${maxDep.toLocaleString()} oralig'ida kiriting.`);
    delete ST[userId].step;
    return handleUzsDeposit(ctx, userId, n, ST, bot);
  }

  if (step === 'stars_amount') {
    const n = parseInt(text, 10);
    const min = sqlite.getSettingNum('star_min_buy', 10);
    if (isNaN(n) || n < min) return ctx.reply(`❌ Minimum ${min} Stars kiriting.`);
    delete ST[userId].step;
    return sendStarsInvoice(ctx, n);
  }

  if (step === 'ai_chat') {
    return handleAiMessage(ctx, userId, text, ST);
  }

  // ── Gift steps ──────────────────────────────────────
  if (await handleGiftStep(ctx, userId, text, ST, bot)) return;

  // ── Stars steps ─────────────────────────────────────
  if (await handleStarsStep(ctx, userId, text, ST, bot)) return;

  // ── Premium steps ────────────────────────────────────
  if (await handlePremiumStep(ctx, userId, text, ST, bot)) return;

  // ── TON steps ────────────────────────────────────────
  if (await handleTonStep(ctx, userId, text, ST, bot)) return;

  // ── Conversion steps ─────────────────────────────────
  if (await handleConversionStep(ctx, userId, text, ST, bot)) return;

  // ── Admin flows ──────────────────────────────────────
  if (!isAdmin) return;

  if (step === 'find_user') { return handleUserSearch(ctx, userId, text, ST, bot); }
  if (step === 'reject_reason') { return handleRejectReason(ctx, userId, text, ST, bot); }
  if (step === 'broadcast_text') { return handleBroadcastStep(ctx, userId, text, ST); }

  if (await handleStarsAdminStep(ctx, userId, text, ST)) return;
  if (await handlePremiumAdminStep(ctx, userId, text, ST)) return;
  if (await handleTonAdminStep(ctx, userId, text, ST)) return;
  if (await handleReferralAdminStep(ctx, userId, text, ST)) return;
  if (await handleApiAdminStep(ctx, userId, text, ST)) return;
  if (await handleSettingsAdminStep(ctx, userId, text, ST)) return;
  if (await handleChannelAdminStep(ctx, userId, text, ST, bot)) return;
  if (await handlePermAdminStep(ctx, userId, text, ST, bot)) return;
});

// ──────────── PHOTO MESSAGE HANDLER ────────────
bot.on('photo', async ctx => {
  const userId = ctx.from.id;
  const step   = ST[userId]?.step || '';
  const fileId = ctx.message.photo.at(-1)?.file_id;
  if (!fileId) return;

  if (step === 'uzs_check') {
    return handleUzsCheck(ctx, userId, fileId, ST, bot);
  }

  // Stars sell proof photo
  if (step === 'stars_sell_proof') {
    const { finalizeStarsSell } = require('./handlers/starsHandler');
    return finalizeStarsSell(ctx, userId, fileId, bot, ST);
  }
});

// ──────────── CRON: unlock expired referral rewards ────────────
cron.schedule('*/30 * * * *', async () => {
  try {
    const unlocked = sqlite.unlockExpiredRewards();
    for (const row of unlocked) {
      // row.inviterId is the person who gets the stars
      await jdb.addStars(row.inviterId, row.amount);
      try {
        await bot.telegram.sendMessage(row.inviterId,
          `🔓 <b>${row.amount} ⭐ Stars qulfdan chiqdi!</b>\n\nReferral mukofotingiz hisobingizga qo'shildi.`,
          { parse_mode: 'HTML' }
        );
      } catch {}
    }
    if (unlocked.length) logger.info(`Unlocked ${unlocked.length} referral rewards`);
  } catch (e) { logger.error('Cron error:', e); }
});

// ──────────── ERROR HANDLER ────────────
bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx?.updateType}:`, err);
});

// ──────────── LAUNCH ────────────
(async () => {
  try {
    // Init DB
    sqlite.init();
    await jdb.initJsonDB();

    // Try restore GramJS session
    try { await gramjs.init(); } catch (e) { logger.warn('GramJS init skipped:', e.message); }

    const me = await bot.telegram.getMe();
    logger.info(`Bot started: @${me.username}`);

    await bot.launch();
    logger.info('Bot polling started');
  } catch (e) {
    logger.error('Fatal startup error:', e);
    process.exit(1);
  }
})();

process.once('SIGINT',  () => { bot.stop('SIGINT');  });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); });
