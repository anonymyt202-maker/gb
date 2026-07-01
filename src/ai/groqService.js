'use strict';
const Groq   = require('groq-sdk');
const sqlite = require('../database/sqlite');
const logger = require('../utils/logger');

const histories = new Map();

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

const ALLOWED_TOPICS = ['stars','premium','ton','order','referral','payment','bot','купить','продать','buy','sell'];

function isRelatedTopic(text) {
  const lower = text.toLowerCase();
  return ALLOWED_TOPICS.some(t => lower.includes(t));
}

function getHistory(userId) {
  if (!histories.has(userId)) histories.set(userId, []);
  return histories.get(userId);
}

function clearHistory(userId) {
  histories.delete(userId);
}

function pruneHistory(history, maxMessages = 10) {
  if (history.length > maxMessages) history.splice(0, history.length - maxMessages);
}

async function ask(userId, userMessage) {
  const enabled = sqlite.getSettingBool('ai_enabled', false);
  if (!enabled) return { ok: false, error: 'AI o\'chirilgan. Admin tomonidan yoqilishi kerak.' };

  const client = getGroqClient();
  if (!client) return { ok: false, error: 'Groq API kaliti yo\'q.' };

  if (!isRelatedTopic(userMessage)) {
    return {
      ok:   true,
      text: '🤖 Kechirasiz, men faqat Stars, Premium, TON, buyurtmalar, referral, to\'lovlar va bot ishlatish haqida savollarni javob bera olaman. Boshqa mavzu haqida yordam bera olmayman.',
    };
  }

  const history = getHistory(userId);
  history.push({ role: 'user', content: userMessage });
  pruneHistory(history);

  const systemPrompt = sqlite.getSetting('ai_system_prompt') ||
    'You are a helpful assistant for a Telegram marketplace bot. Only answer questions about Stars, Premium, TON, orders, referral, payments, and bot usage. If asked about anything else, politely refuse. Respond in the same language the user writes in.';

  const model = sqlite.getSetting('groq_model') || 'llama3-8b-8192';

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      max_tokens: 512,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'Javob olishda xato.';
    history.push({ role: 'assistant', content: reply });
    pruneHistory(history);
    return { ok: true, text: reply };
  } catch (e) {
    logger.error('Groq API error', { message: e.message });
    return { ok: false, error: `AI xatosi: ${e.message}` };
  }
}

module.exports = { ask, clearHistory, isRelatedTopic };
