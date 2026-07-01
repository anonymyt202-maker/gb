'use strict';
/**
 * GramJS Session Generator
 * Run: npm run session
 * Generates a SESSION_STRING for the .env file.
 */
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const readline           = require('readline');
const path               = require('path');
const fs                 = require('fs');

// Load .env if present
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {}

const API_ID   = parseInt(process.env.API_ID   || '', 10);
const API_HASH = process.env.API_HASH || '';

if (!API_ID || !API_HASH) {
  console.error(`
❌  API_ID and API_HASH are required.

1. Go to https://my.telegram.org
2. Log in → API Development Tools
3. Create an app and copy API_ID + API_HASH
4. Add them to your .env file:
     API_ID=12345678
     API_HASH=your_api_hash_here

Then re-run: npm run session
`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

(async () => {
  console.log('\n📱 Telegram Session Generator\n');
  console.log('Bu sessiya Stars sovg\'alarini yuborish uchun ishlatiladi.\n');

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber:   async () => ask('📞 Telefon raqami (+998...): '),
    password:      async () => ask('🔑 2FA parol (agar bo\'lsa): '),
    phoneCode:     async () => ask('📨 SMS kodini kiriting: '),
    onError:       (err)    => console.error('Xato:', err.message),
  });

  const session = client.session.save();
  console.log('\n✅ Session yaratildi!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SESSION_STRING=' + session);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n👆 Yuqoridagi qatorni .env fayliga qo\'shing.\n');

  // Optionally append to .env
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const append = await ask('.env fayliga avtomatik qo\'shsinmi? (y/n): ');
    if (append.trim().toLowerCase() === 'y') {
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (existing.includes('SESSION_STRING=')) {
        const updated = existing.replace(/^SESSION_STRING=.*$/m, `SESSION_STRING=${session}`);
        fs.writeFileSync(envPath, updated);
      } else {
        fs.appendFileSync(envPath, `\nSESSION_STRING=${session}\n`);
      }
      console.log('✅ .env fayliga yozildi.');
    }
  } catch {}

  rl.close();
  await client.disconnect();
  process.exit(0);
})().catch(e => {
  console.error('❌ Xato:', e.message);
  rl.close();
  process.exit(1);
});
