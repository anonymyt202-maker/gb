# 🎁 RM Gift Bot — Node.js (Telegraf + Express + better-sqlite3)

Python loyihasidan to'liq Node.js'ga o'tkazilgan, yangi funksiyalar bilan kengaytirilgan versiya.

## 📁 Tuzilma (10 fayl)

```
rmbot/
├── app.js          ← Kirish nuqtasi: Express server + bot ishga tushirish
├── bot.js          ← Telegraf bot: /start, balans, referral, o'yinlar (dice/mines/slots...)
├── routes.js       ← Barcha API endpointlar (gifts, orders, cases, payments, promo, users, accounts, channels)
├── database.js     ← SQLite schema + barcha DB funksiyalar (better-sqlite3)
├── giftSender.js   ← Telegram Bot API orqali gift yuborish (sendGift)
├── config.js       ← .env dan barcha sozlamalar
├── package.json
├── Procfile        ← Railway/Heroku uchun
├── .env.example
└── web/
    ├── index.html  ← User WebApp (Gift Shop, Cases, Games, Wallet, Profile)
    └── admin.html  ← Admin Panel (Dashboard, Gifts, Cases, Users, Orders, Payments, Promo, Accounts, Channels)
```

## 🔄 Python → Node.js mapping

| Python fayl | Node.js fayl | Izoh |
|---|---|---|
| `config.py` | `config.js` | barcha settings + yangi RM Coin kurslari |
| `db/models/*.py`, `db/session.py` | `database.js` | better-sqlite3 bilan, sinxron, oddiy |
| `api/main.py`, `api/routers/*.py`, `api/auth.py` | `routes.js` | initData HMAC tekshirish saqlangan |
| `gift_sender/sender.py` (Telethon) | `giftSender.js` | Bot API `sendGift` metodiga o'tkazildi |
| `bot/main.py`, `bot/handlers/*.py`, `bot/keyboards/*.py` | `bot.js` | Telegraf, barcha komandalar + yangi o'yinlar |
| `webapp/user.html` | `web/index.html` | to'liq qayta yozildi, yangi funksiyalar |
| `webapp/admin.html` | `web/admin.html` | to'liq qayta yozildi |
| `run.py` | `app.js` | Express + Telegraf bitta processda |

## 🪙 RM Coin tizimi

- **1 RM Coin = 1 ⭐ Stars = 150 so'm** (sozlanadi `.env` orqali: `RM_TO_STARS`, `RM_TO_UZS`)
- Barcha gift narxlari RM Coin'da
- O'yinlar RM Coin orqali o'ynaladi
- Konvertatsiya: RM → Stars, RM → UZS (Wallet bo'limida)

## 🎮 O'yinlar

| O'yin | Qoidalar |
|---|---|
| 🎲 Zar | 6→2×, 5→1.5×, 4→1× (qaytarish), 3→0.5×, 1-2→yutqazish |
| ⚽ Futbol | 3-5→1.44× |
| 🏀 Basketbol | 4-5→1.5× |
| 🎯 Darts | 6→2×, 4-5→1.5× |
| 🎰 Slotlar | 777→5×, kunlik limit |
| 🪙 Coin Flip | 50% → 1.9× |
| 💣 **Mines** | 5x5 grid, foydalanuvchi bomba sonini tanlaydi (1/3/5/10/24), har ochilgan katak koeffitsientni oshiradi, istalgan vaqtda pul yechish mumkin. **Butun son koeffitsient**: masalan 1 RM tikilsa va 1.57× chiqsa — 1.57 RM qaytadi. |
| 🎁 Kunlik bonus | 1-3 RM Coin, 24 soatda 1 marta |

## 📦 Cases (Case Opening)

Admin panel orqali case yaratiladi:
- **Nomi, rasm, narx (RM Coin)**
- **Yutuqlar ro'yxati**: har biri `name`, `type` (`rm` / `stars` / `gift` / `nft`), `value`, `chance %`, `rarity` (common/rare/epic/legendary)
- Chance yig'indisi **100%** bo'lishi shart (admin panel tekshiradi)
- `rm` va `stars` turlari **avtomatik** beriladi, `gift`/`nft` — admin tomonidan qo'lda yetkaziladi
- **Limited** case: umumiy son tugagach yopiladi
- Case ochishda **animatsiyali spin** (CSS transition, 3.5s)

### Tavsiya etilgan case namunasi (o'zingiz qo'shasiz)
```json
{
  "name": "Starter Case",
  "price_rm": 20,
  "prizes": [
    {"name": "5 RM Coin", "type": "rm", "value": "5", "chance": 40, "rarity": "common"},
    {"name": "15 RM Coin", "type": "rm", "value": "15", "chance": 30, "rarity": "common"},
    {"name": "25 Stars", "type": "stars", "value": "25", "chance": 15, "rarity": "rare"},
    {"name": "100 Stars", "type": "stars", "value": "100", "chance": 8, "rarity": "epic"},
    {"name": "Premium Gift 🎁", "type": "gift", "value": "Telegram Premium Gift", "chance": 5, "rarity": "epic"},
    {"name": "NFT Plush Pepe", "type": "nft", "value": "Plush Pepe NFT", "chance": 2, "rarity": "legendary"}
  ]
}
```

## 👥 Referral tizimi

- Har bir foydalanuvchi noyob referal kod va link oladi (`/start ref_CODE`)
- Yangi do'st ro'yxatdan o'tganda → taklif qilgan kishi **+1 RM Coin** (sozlanadi `REFERRAL_REWARD`)
- Do'st birinchi gift sotib olganda → taklif qilgan kishi **gift narxining 1%**ini RM Coin sifatida oladi

## 📣 Majburiy kanal

Admin panelda `Kanallar` bo'limidan kanal qo'shiladi (`@channelusername`). WebApp ochilganda foydalanuvchi a'zoligi tekshiriladi (`getChatMember` Bot API), agar a'zo bo'lmasa — obuna devori ko'rsatiladi.

> ⚠️ Bot kanalda **admin** bo'lishi kerak, aks holda `getChatMember` ishlamaydi.

## 💳 Pul kiritish

1. User WebApp → Hamyon → Pul Kiritish
2. Summani kiritadi (so'mda), screenshot yuklaydi
3. So'rov adminga keladi (Admin Panel → To'lovlar)
4. Admin tasdiqlaganda foydalanuvchi balansiga RM Coin avtomatik qo'shiladi (`amount_uzs / RM_TO_UZS`)

## 🎟 Promo kodlar

Admin panel orqali promo kod yaratiladi (`percent` yoki `fixed` chegirma, max ishlatish soni, tugash sanasi). Foydalanuvchi gift sotib olishda promo kod kiritishi mumkin.

## 📱 Telegram Account / Gift yuborish

Hozirgi versiya **Telegram Bot API**'ning `sendGift` metodidan foydalanadi (Telethon o'rniga — sodda va barqaror). Bu metod ishlashi uchun:
- Bot Stars balansiga ega bo'lishi kerak (gift narxi Stars'da to'lanadi)
- `BOT_TOKEN` to'g'ri sozlangan bo'lishi kerak

`Accountlar` bo'limi kelajakda MTProto session orqali kengaytirish uchun saqlangan (hozircha ixtiyoriy).

## ⚙️ O'rnatish

```bash
cp .env.example .env
# .env faylni to'ldiring (BOT_TOKEN, ADMIN_IDS, API_BASE_URL, va h.k.)

npm install
npm start
```

Server: `http://localhost:3000`
- User WebApp: `/webapp/user`
- Admin Panel: `/webapp/admin`

## 🌐 Railway deploy

1. GitHub'ga push qiling
2. Railway → New Project → Deploy from GitHub
3. Environment Variables qo'shing (`.env.example` dagi barcha qiymatlar)
4. Start command avtomatik: `npm start` (Procfile orqali)
5. `API_BASE_URL`'ni Railway domeningizga moslang (masalan `https://yourapp.up.railway.app`)

## 🖼 RM Coin rasm

`web/static/rm.jpg` (yoki `/static/rm.jpg`) — o'zingiz yaratgan rasmni shu joyga qo'ying, header'da avtomatik ko'rsatiladi (kichik dumaloq icon, 28x28px).

## 🔐 Admin autentifikatsiya

WebApp Telegram `initData` orqali HMAC-SHA256 bilan tekshiriladi. Faqat `.env` dagi `ADMIN_IDS`'da ko'rsatilgan Telegram ID'lar admin panelga kira oladi.

**Dev rejim**: agar `BOT_TOKEN=test` yoki `DEV_MODE=true` bo'lsa, initData tekshirilmaydi (faqat local test uchun!).

## 📊 API Endpoints (qisqacha)

```
GET    /api/users/me
GET    /api/users/admin/all
POST   /api/users/admin/balance
POST   /api/users/admin/ban
POST   /api/users/convert

GET    /api/gifts
GET    /api/gifts/categories
GET    /api/gifts/:id
GET    /api/gifts/admin/all
POST   /api/gifts/admin
PUT    /api/gifts/admin/:id
DELETE /api/gifts/admin/:id

POST   /api/orders
GET    /api/orders/my
GET    /api/orders/admin/all

GET    /api/cases
GET    /api/cases/admin/all
POST   /api/cases/admin
DELETE /api/cases/admin/:id
POST   /api/cases/:id/open

POST   /api/payments/request
GET    /api/payments/admin/all
POST   /api/payments/admin/:id/approve
POST   /api/payments/admin/:id/reject

GET    /api/admin/promo
POST   /api/admin/promo
DELETE /api/admin/promo/:id

GET    /api/channels
POST   /api/channels
DELETE /api/channels/:id
GET    /api/channels/check

GET    /api/accounts
POST   /api/accounts/manual
PATCH  /api/accounts/:id/toggle
DELETE /api/accounts/:id

GET    /api/admin/dashboard
GET    /api/admin/referrals
```
