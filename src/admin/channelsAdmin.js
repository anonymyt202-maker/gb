'use strict';
const jdb   = require('../database/json');
const admKb = require('../keyboards/adminKeyboard');
const { esc } = require('../utils/format');

function registerChannelsAdmin(bot, ST) {
  bot.action('adm_channels', async ctx => {
    await ctx.answerCbQuery();
    await showChannels(ctx);
  });

  bot.action('adm_ch_add', async ctx => {
    await ctx.answerCbQuery();
    const adminId = ctx.from.id;
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].step = 'ch_add_id';
    await ctx.editMessageText(
      '📢 <b>Kanal qo\'shish</b>\n\nKanal ID (@username yoki -100xxxxxxxxx) ni kiriting:',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Orqaga', callback_data: 'adm_channels' }]] }}
    );
  });

  bot.action(/^adm_ch_del_(.+)$/, async ctx => {
    await ctx.answerCbQuery();
    const channelId = ctx.match[1];
    const channels  = await jdb.getSubChannels();
    const filtered  = channels.filter(c => String(c.id) !== channelId);
    await jdb.saveSubChannels(filtered);
    await showChannels(ctx);
  });
}

async function showChannels(ctx) {
  const channels = await jdb.getSubChannels();
  const rows = channels.map(c => [{
    text: `📢 ${c.title || c.id} ${c.required ? '🔒' : ''}`,
    callback_data: `adm_ch_del_${c.id}`,
  }]);
  rows.push([{ text: '➕ Kanal qo\'shish', callback_data: 'adm_ch_add' }]);
  rows.push([{ text: '⬅️ Admin', callback_data: 'adm_panel' }]);
  await ctx.editMessageText(
    `📢 <b>Majburiy kanallar</b> (${channels.length} ta)\n\nO\'chirish uchun kanalni bosing.`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows }}
  );
}

async function handleChannelAdminStep(ctx, adminId, text, ST, bot) {
  const step = ST[adminId]?.step || '';
  if (step === 'ch_add_id') {
    if (!ST[adminId]) ST[adminId] = {};
    ST[adminId].chAddId = text.trim();
    ST[adminId].step    = 'ch_add_required';
    await ctx.reply(
      `Kanal: <code>${esc(text.trim())}</code>\n\nMajburiy obunalikmi?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '🔒 Ha, majburiy', callback_data: 'ch_req_1' }, { text: '🔓 Yo\'q', callback_data: 'ch_req_0' }],
        [{ text: '⬅️ Bekor', callback_data: 'adm_channels' }],
      ]}}
    );
    return true;
  }
  return false;
}

async function handleChannelRequired(ctx, adminId, required, ST, bot) {
  const chId = ST[adminId]?.chAddId;
  if (!chId) return;
  delete ST[adminId].step;
  delete ST[adminId].chAddId;
  // Try to get channel info
  let title = chId;
  try {
    const info = await bot.telegram.getChat(chId);
    title = info.title || chId;
  } catch {}
  const channels = await jdb.getSubChannels();
  if (!channels.find(c => String(c.id) === String(chId))) {
    channels.push({ id: chId, title, required: required === '1', addedAt: new Date().toISOString() });
    await jdb.saveSubChannels(channels);
  }
  await ctx.reply(`✅ Kanal qo\'shildi: ${title}`);
}

module.exports = { registerChannelsAdmin, handleChannelAdminStep, handleChannelRequired };
