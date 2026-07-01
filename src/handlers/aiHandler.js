'use strict';
const groq   = require('../ai/groqService');
const sqlite = require('../database/sqlite');
const mainKb = require('../keyboards/mainKeyboard');

function registerAiHandlers(bot, ST) {
  bot.action('ai_help', async ctx => {
    await ctx.answerCbQuery();
    const enabled = sqlite.getSettingBool('ai_enabled', false);
    if (!enabled) {
      return ctx.editMessageText(
        '🤖 <b>AI Yordam</b>\n\nHozir AI yordamchisi o\'chirilgan.',
        { parse_mode: 'HTML', ...mainKb.back() }
      );
    }
    const userId = ctx.from.id;
    if (!ST[userId]) ST[userId] = {};
    ST[userId].step = 'ai_chat';
    await ctx.editMessageText(
      '🤖 <b>AI Yordamchi</b>\n\nSavollaringizni yozing. Men faqat quyidagi mavzular bo\'yicha yordam bera olaman:\n\n⭐ Stars · 💎 Premium · 💰 TON\n📦 Buyurtmalar · 👥 Referral · 💳 To\'lovlar\n\n/ai_exit — Chiqish',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🚪 Chiqish', callback_data: 'ai_exit' }],
      ]}}
    );
  });

  bot.action('ai_exit', async ctx => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (ST[userId]) { delete ST[userId].step; groq.clearHistory(userId); }
    await ctx.editMessageText('✅ AI chat yopildi.', mainKb.back());
  });
}

async function handleAiMessage(ctx, userId, text, ST) {
  const typing = await ctx.reply('🤖 Javob tayyorlanmoqda...');
  const result = await groq.ask(userId, text);
  try { await ctx.telegram.deleteMessage(ctx.chat.id, typing.message_id); } catch {}
  if (result.ok) {
    await ctx.reply(`🤖 ${result.text}`, {
      reply_markup: { inline_keyboard: [[{ text: '🚪 Chiqish', callback_data: 'ai_exit' }]] }
    });
  } else {
    await ctx.reply(`❌ ${result.error}`, {
      reply_markup: { inline_keyboard: [[{ text: '🚪 Chiqish', callback_data: 'ai_exit' }]] }
    });
  }
}

module.exports = { registerAiHandlers, handleAiMessage };
