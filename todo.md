# GiftBot Node.js - Project TODO

## Phase 1: Core Infrastructure
- [ ] Database schema (users, gifts, cases, orders, referrals, promo_codes, game_sessions)
- [ ] Database initialization and migration utilities
- [ ] Express server setup with Telegraf bot integration
- [ ] Environment configuration and .env.example

## Phase 2: Telegram Bot
- [ ] /start command with referral link handling
- [ ] Mandatory channel subscription check
- [ ] Account linking flow
- [ ] Bot webhook setup for Express
- [ ] Main menu keyboard

## Phase 3: User MiniApp (user.html)
- [ ] Wallet section (balance display, deposit via Stars/UZS)
- [ ] Gift shop (browse, filter by category, purchase)
- [ ] Gift sending system (anonymous/with message)
- [ ] Promo code input and validation
- [ ] Friend referral system (1% commission)
- [ ] Telegram Premium purchase section
- [ ] User profile and settings

## Phase 4: Games Implementation
- [ ] Mines game (bomb count, bet, multiplier, fractional wins)
- [ ] Cases/Loot boxes (admin-configurable, animation)
- [ ] Coin Flip game
- [ ] Slots game
- [ ] Dice game
- [ ] Game session tracking and history

## Phase 5: Admin Panel (admin.html)
- [ ] Dashboard with stats (users, revenue, active games)
- [ ] User management (search, edit balance, ban)
- [ ] Gift CRUD (create, edit, delete, manage stock)
- [ ] Case CRUD (create, edit, delete, manage rewards)
- [ ] Promo code management
- [ ] Referral stats and leaderboard
- [ ] Order history and filtering

## Phase 6: RM Coin Currency System
- [ ] Currency conversion (1 RM Coin = 1 Star = 150 UZS)
- [ ] Balance tracking and updates
- [ ] Transaction history
- [ ] Deposit/withdrawal flows

## Phase 7: API Routes
- [ ] Authentication and JWT tokens
- [ ] User endpoints (/api/users/*)
- [ ] Gift endpoints (/api/gifts/*)
- [ ] Order endpoints (/api/orders/*)
- [ ] Game endpoints (/api/games/*)
- [ ] Admin endpoints (/api/admin/*)
- [ ] Promo code endpoints (/api/promo/*)
- [ ] Referral endpoints (/api/referrals/*)

## Phase 8: UI/UX Polish
- [ ] Responsive design for all screens
- [ ] Animations for case opening
- [ ] Loading states and error handling
- [ ] Toast notifications
- [ ] Modal dialogs
- [ ] Dark/light theme support

## Phase 9: Testing & Deployment
- [ ] End-to-end testing of all features
- [ ] Bot webhook testing
- [ ] Payment flow testing
- [ ] Game logic verification
- [ ] Railway deployment configuration
- [ ] Production environment setup

## Bugs & Fixes
- [ ] Fix user.html not found issue (rename from index.html if needed)
- [ ] Fix admin panel dashboard loading
- [ ] Ensure all games calculate fractional multipliers correctly
- [ ] Verify referral commission calculation (1% of gift purchase)
- [ ] Test mandatory channel subscription enforcement

## Completed Tasks
