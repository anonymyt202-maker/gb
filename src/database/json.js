'use strict';
const fs   = require('fs').promises;
const path = require('path');
const cfg  = require('../config');

const rj = async (fp, fb) => {
  try { return JSON.parse(await fs.readFile(fp, 'utf-8')); } catch { return fb; }
};
const wj = async (fp, v) => {
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(v, null, 2));
};

async function initJsonDB() {
  const defaults = [
    [cfg.DB.users, []], [cfg.DB.gifts, []], [cfg.DB.deposits, []],
    [cfg.DB.channels, []], [cfg.DB.claims, {}],
  ];
  for (const [fp, fb] of defaults) {
    try { await fs.access(fp); } catch { await wj(fp, fb); }
  }
}

// ── USERS ──────────────────────────────────────────────────────
const getUsers  = () => rj(cfg.DB.users, []);
const saveUsers = u  => wj(cfg.DB.users, u);

async function getUser(id) {
  const u = await getUsers();
  return u.find(x => Number(x.userId) === Number(id)) || null;
}

async function addUser(id, username, referredBy = null) {
  const u = await getUsers();
  if (u.find(x => Number(x.userId) === Number(id))) return false;
  u.push({
    userId: Number(id), username,
    stars: 0, uzs: 0,
    lockedStars: 0,
    invitedBy: referredBy ? Number(referredBy) : null,
    referralRewarded: false,
    lastDailyBonusAt: null,
    joinedAt: new Date().toISOString(),
    isActive: true,
    blockedBot: false,
  });
  await saveUsers(u);
  return true;
}

async function upsertUser(id, patch) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  u[i] = { ...u[i], ...patch };
  await saveUsers(u);
  return true;
}

async function addStars(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  u[i].stars = Math.max(0, Number(u[i].stars || 0) + Number(n || 0));
  await saveUsers(u);
  return true;
}

async function deductStars(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  const cur = Number(u[i].stars || 0);
  if (cur < n) return false;
  u[i].stars = cur - Number(n);
  await saveUsers(u);
  return true;
}

async function getStars(id) {
  const u = await getUser(id);
  return Number(u?.stars || 0);
}

async function addLockedStars(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  u[i].lockedStars = Math.max(0, Number(u[i].lockedStars || 0) + Number(n || 0));
  await saveUsers(u);
  return true;
}

async function unlockStars(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  const locked = Number(u[i].lockedStars || 0);
  const toUnlock = Math.min(locked, Number(n || 0));
  u[i].lockedStars = locked - toUnlock;
  u[i].stars = Number(u[i].stars || 0) + toUnlock;
  await saveUsers(u);
  return toUnlock;
}

async function addUzs(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  u[i].uzs = Math.max(0, Number(u[i].uzs || 0) + Number(n || 0));
  await saveUsers(u);
  return true;
}

async function deductUzs(id, n) {
  const u = await getUsers();
  const i = u.findIndex(x => Number(x.userId) === Number(id));
  if (i === -1) return false;
  const cur = Number(u[i].uzs || 0);
  if (cur < n) return false;
  u[i].uzs = cur - Number(n);
  await saveUsers(u);
  return true;
}

async function getUzs(id) {
  const u = await getUser(id);
  return Number(u?.uzs || 0);
}

// ── GIFTS ─────────────────────────────────────────────────────
const getGifts  = () => rj(cfg.DB.gifts, []);
const saveGifts = g  => wj(cfg.DB.gifts, g);

// ── DEPOSITS ──────────────────────────────────────────────────
const getDeposits  = () => rj(cfg.DB.deposits, []);
const saveDeposits = d  => wj(cfg.DB.deposits, d);

// ── CHANNELS (subscription check channels) ───────────────────
const getSubChannels  = () => rj(cfg.DB.channels, []);
const saveSubChannels = c  => wj(cfg.DB.channels, c);

// ── CLAIMS ────────────────────────────────────────────────────
const getClaims  = () => rj(cfg.DB.claims, {});
const saveClaims = c  => wj(cfg.DB.claims, c);

async function isClaimUsed(claimKey) {
  const claims = await getClaims();
  return !!claims[claimKey];
}
async function markClaimUsed(claimKey, userId) {
  const claims = await getClaims();
  claims[claimKey] = { usedBy: Number(userId), usedAt: new Date().toISOString() };
  await saveClaims(claims);
}

// ── SESSION ───────────────────────────────────────────────────
async function sessionLoad() {
  try { return (JSON.parse(await fs.readFile(cfg.DB.session, 'utf-8'))).session || ''; }
  catch { return ''; }
}
async function sessionSave(s) {
  await fs.mkdir(path.dirname(cfg.DB.session), { recursive: true });
  await fs.writeFile(cfg.DB.session, JSON.stringify({ session: s }, null, 2));
}

module.exports = {
  initJsonDB, rj, wj,
  getUsers, saveUsers, getUser, addUser, upsertUser,
  addStars, deductStars, getStars,
  addLockedStars, unlockStars,
  addUzs, deductUzs, getUzs,
  getGifts, saveGifts,
  getDeposits, saveDeposits,
  getSubChannels, saveSubChannels,
  getClaims, saveClaims, isClaimUsed, markClaimUsed,
  sessionLoad, sessionSave,
};
