import path from 'node:path';
import process from 'node:process';

function boolEnv(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}

function intEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const authMode = (process.env.AUTH_MODE || (nodeEnv === 'production' ? 'google' : 'dev')).toLowerCase();
if (nodeEnv === 'production' && authMode === 'dev' && !boolEnv('ALLOW_DEV_AUTH', false)) {
  throw new Error('AUTH_MODE=dev is disabled in production unless ALLOW_DEV_AUTH=true.');
}

export const config = Object.freeze({
  nodeEnv,
  host: process.env.HOST || '0.0.0.0',
  port: intEnv('PORT', 8080),
  appBaseUrl: (process.env.APP_BASE_URL || `http://localhost:${intEnv('PORT',8080)}`).replace(/\/$/, ''),
  databasePath: path.resolve(process.env.DATABASE_PATH || './data/dws.sqlite'),
  trustProxy: boolEnv('TRUST_PROXY', false),
  authMode,
  sessionSecret: process.env.SESSION_SECRET || 'development-only-change-me-please-32chars',
  sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY || '',
  sessionTtlHours: intEnv('SESSION_TTL_HOURS', 8),
  cookieSecure: boolEnv('COOKIE_SECURE', nodeEnv === 'production'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || `${(process.env.APP_BASE_URL || `http://localhost:${intEnv('PORT',8080)}`).replace(/\/$/, '')}/auth/google/callback`,
  googleSheetsScope: boolEnv('GOOGLE_SHEETS_SCOPE', true),
  bootstrapAdminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME || '',
  devUserEmail: (process.env.DEV_USER_EMAIL || 'admin@example.com').trim().toLowerCase(),
  devUserName: process.env.DEV_USER_NAME || 'Local Admin',
  maxRpcBodyBytes: intEnv('MAX_RPC_BODY_BYTES', 12 * 1024 * 1024)
});

if (config.nodeEnv === 'production' && config.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}
if (config.authMode === 'google' && (!config.googleClientId || !config.googleClientSecret)) {
  throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when AUTH_MODE=google.');
}
