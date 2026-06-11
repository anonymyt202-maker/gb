import { Telegraf } from 'telegraf';
import { getUserByTelegramId, createUser, updateUserBalance, createReferral, getReferralsByInviter } from '../db/queries.js';
import { generateToken } from '../utils/auth.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const MANDATORY_CHANNEL = process.env.MANDATORY_CHANNEL || '@giftbot_channel';
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://example.com';

let bot = null;

export function initBot() {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN environment variable is required');
  }

  bot = new Telegraf(BOT_TOKEN);

  // Start command
  bot.start(async (ctx) => {
    const { id, username, first_name } = ctx.from;
    let user = getUserByTelegramId(id);

    // Check for referral code in deep link
    const args = ctx.startPayload;
    if (args && !user) {
      // User is new and has a referral code
      const referrerUser = getUserByTelegramId(parseInt(args));
      if (referrerUser) {
        user = createUser(id, username, first_name);
        createReferral(referrerUser.id, user.id);
        // Give referrer 1 star bonus
        updateUserBalance(referrerUser.id, 0, 1, 0);
      }
    }

    if (!user) {
      user = createUser(id, username, first_name);
    }

    const token = generateToken(user.id);

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🎮 Open MiniApp',
            web_app: { url: `${WEBAPP_URL}/user.html?token=${token}` },
          },
        ],
        [
          {
            text: '📱 Subscribe Channel',
            url: `https://t.me/${MANDATORY_CHANNEL.replace('@', '')}`,
          },
        ],
        [
          {
            text: '👥 Invite Friends',
            switch_inline_query: `ref_${user.referral_code}`,
          },
        ],
      ],
    };

    if (ADMIN_IDS.includes(id)) {
      keyboard.inline_keyboard.push([
        {
          text: '⚙️ Admin Panel',
          web_app: { url: `${WEBAPP_URL}/admin.html?token=${token}` },
        },
      ]);
    }

    await ctx.reply(
      `👋 Welcome to GiftBot!\n\n` +
      `💰 Balance: ${user.rm_coins} RM Coins\n` +
      `⭐ Stars: ${user.stars}\n\n` +
      `🎁 Send gifts, play games, and earn rewards!`,
      { reply_markup: keyboard }
    );
  });

  // Help command
  bot.help(async (ctx) => {
    await ctx.reply(
      `📖 GiftBot Help\n\n` +
      `/start - Start the bot\n` +
      `/help - Show this message\n` +
      `/balance - Check your balance\n` +
      `/profile - View your profile\n\n` +
      `🎮 Use the MiniApp to:\n` +
      `• Send gifts\n` +
      `• Play games (Mines, Cases, Slots, Dice, Coin Flip)\n` +
      `• Manage your wallet\n` +
      `• View referral stats`
    );
  });

  // Balance command
  bot.command('balance', async (ctx) => {
    const user = getUserByTelegramId(ctx.from.id);
    if (!user) {
      return await ctx.reply('❌ User not found');
    }

    await ctx.reply(
      `💰 Your Balance\n\n` +
      `RM Coins: ${user.rm_coins}\n` +
      `⭐ Stars: ${user.stars}\n` +
      `💵 UZS: ${user.uzs}`
    );
  });

  // Profile command
  bot.command('profile', async (ctx) => {
    const user = getUserByTelegramId(ctx.from.id);
    if (!user) {
      return await ctx.reply('❌ User not found');
    }

    const referrals = getReferralsByInviter(user.id);
    const referralCount = referrals.length;

    await ctx.reply(
      `👤 Your Profile\n\n` +
      `Username: @${user.username || 'N/A'}\n` +
      `Name: ${user.first_name}\n` +
      `Referral Code: \`${user.referral_code}\`\n` +
      `Referrals: ${referralCount}\n` +
      `Joined: ${new Date(user.created_at).toLocaleDateString()}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle text messages
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith('/')) {
      // Command not recognized
      return await ctx.reply('❌ Unknown command. Use /help for available commands.');
    }

    // Echo message
    await ctx.reply(`You said: ${text}`);
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again.');
  });

  return bot;
}

export function getBot() {
  return bot;
}

export async function launchBot() {
  if (!bot) {
    throw new Error('Bot not initialized. Call initBot() first.');
  }

  // Use webhook in production, polling in development
  if (process.env.NODE_ENV === 'production') {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL environment variable is required for production');
    }
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Bot webhook set to:', webhookUrl);
  } else {
    await bot.launch();
    console.log('✅ Bot launched in polling mode');
  }
}

export async function stopBot() {
  if (bot) {
    await bot.stop();
    console.log('✅ Bot stopped');
  }
}
