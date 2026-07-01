'use strict';
const axios  = require('axios');
const sqlite = require('../database/sqlite');
const logger = require('../utils/logger');

const RETRY_COUNT = 2;
const TIMEOUT_MS  = 15000;

function getApiConfig() {
  const s = sqlite.getApiSettings();
  return {
    url:     s.apiUrl  || '',
    key:     s.apiKey  || '',
    enabled: s.enabled === 1,
  };
}

async function request(method, endpoint, data = null, retries = RETRY_COUNT) {
  const cfg = getApiConfig();
  if (!cfg.enabled) return { ok: false, error: 'API disabled' };
  if (!cfg.url || !cfg.key) return { ok: false, error: 'API not configured' };

  const url    = `${cfg.url.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const config = {
    method,
    url,
    timeout: TIMEOUT_MS,
    headers: { 'X-API-Key': cfg.key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
  };
  if (data) config.data = data;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios(config);
      sqlite.updateApiSettings({ lastSuccess: new Date().toISOString() });
      return { ok: true, data: res.data };
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Unknown error';
      logger.error(`FragmentAPI error attempt ${attempt + 1}`, { endpoint, error: errMsg });
      sqlite.updateApiSettings({ lastError: `[${new Date().toISOString()}] ${errMsg}` });
      if (attempt === retries) return { ok: false, error: errMsg };
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { ok: false, error: 'Max retries exceeded' };
}

async function checkBalance() {
  const res = await request('GET', '/balance');
  if (res.ok) {
    const balance = res.data?.balance ?? res.data?.stars ?? null;
    if (balance !== null) sqlite.updateApiSettings({ lastBalance: balance });
    return { ok: true, balance };
  }
  return res;
}

async function buyStars(username, amount) {
  return request('POST', '/stars/buy', { username, amount });
}

async function buyPremium(username, months) {
  return request('POST', '/premium/buy', { username, months });
}

async function testConnection() {
  const res = await request('GET', '/ping');
  return res;
}

function updateApiKey(apiKey) {
  sqlite.updateApiSettings({ apiKey });
}

function updateApiUrl(apiUrl) {
  sqlite.updateApiSettings({ apiUrl });
}

function setEnabled(enabled) {
  sqlite.updateApiSettings({ enabled: enabled ? 1 : 0 });
}

module.exports = {
  checkBalance, buyStars, buyPremium,
  testConnection, updateApiKey, updateApiUrl, setEnabled,
};
