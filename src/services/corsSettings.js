const { getDb } = require('../db');

const SETTINGS_KEY = 'cors';

const DEFAULT_SETTINGS = {
  enabled: true,
  allowAll: false,
  allowCredentials: true,
  origins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ],
  allowedMethods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept',
};

function normalizeSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS, ...raw };
  settings.enabled = Boolean(settings.enabled);
  settings.allowAll = Boolean(settings.allowAll);
  settings.allowCredentials = Boolean(settings.allowCredentials);
  settings.origins = Array.isArray(settings.origins)
    ? settings.origins.map((o) => String(o).trim()).filter(Boolean)
    : DEFAULT_SETTINGS.origins;
  settings.allowedMethods = settings.allowedMethods || DEFAULT_SETTINGS.allowedMethods;
  settings.allowedHeaders = settings.allowedHeaders || DEFAULT_SETTINGS.allowedHeaders;
  return settings;
}

function getSettings() {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(SETTINGS_KEY);
  if (!row) return normalizeSettings({});
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return normalizeSettings({});
  }
}

function saveSettings(data) {
  const settings = normalizeSettings({
    enabled: data.enabled === true || data.enabled === '1' || data.enabled === 'on',
    allowAll: data.allowAll === true || data.allowAll === '1' || data.allowAll === 'on',
    allowCredentials:
      data.allowCredentials === true || data.allowCredentials === '1' || data.allowCredentials === 'on',
    origins: parseOriginsInput(data.origins),
    allowedMethods: data.allowedMethods || DEFAULT_SETTINGS.allowedMethods,
    allowedHeaders: data.allowedHeaders || DEFAULT_SETTINGS.allowedHeaders,
  });

  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(SETTINGS_KEY, JSON.stringify(settings));

  return settings;
}

function parseOriginsInput(input) {
  if (Array.isArray(input)) return input;
  return String(input || '')
    .split(/[\n,]+/)
    .map((o) => o.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, settings) {
  if (!settings.enabled || !origin) return false;
  if (settings.allowAll) return true;
  if (settings.origins.includes('*')) return true;
  return settings.origins.includes(origin);
}

function resolveAllowOrigin(origin, settings) {
  if (!settings.enabled || !origin) return null;
  if (!isOriginAllowed(origin, settings)) return null;
  if (settings.allowAll || settings.origins.includes('*')) return origin;
  return origin;
}

module.exports = {
  getSettings,
  saveSettings,
  isOriginAllowed,
  resolveAllowOrigin,
  DEFAULT_SETTINGS,
  parseOriginsInput,
};
