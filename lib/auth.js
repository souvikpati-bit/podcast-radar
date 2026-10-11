// Admin login (cookie) and cron secret checks. Credentials are verified on every request.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env.js';
import { query, dbConfigured, ensureSchema } from './db.js';

export const COOKIE = 'radar_admin';
const WEEK_MS = 7 * 86400000;
const MAX_ATTEMPTS = 5;
const WINDOW_MIN = 15;

const sha = (s) => createHash('sha256').update(String(s)).digest();

export function safeEqual(a, b) {
  return timingSafeEqual(sha(a), sha(b)); // hashing first makes lengths equal, so the compare is constant time
}

function sign(payload) {
  const { adminKey } = getEnv();
  return createHmac('sha256', `radar-session:${adminKey}`).update(payload).digest('hex');
}

export function makeToken(now = Date.now()) {
  const exp = String(now + WEEK_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token, now = Date.now()) {
  if (!getEnv().adminKey || !token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < now) return false;
  return safeEqual(sig, sign(exp));
}

export function cookieValue(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function isAdminRequest(request) {
  return verifyToken(cookieValue(request.headers.get('cookie')));
}

export function requireAdmin(request) {
  if (!getEnv().adminKey) return Response.json({ error: 'Settings are locked: ADMIN_KEY is not set' }, { status: 401 });
  if (!isAdminRequest(request)) return Response.json({ error: 'Login required' }, { status: 401 });
  return null;
}

export function requireCron(request) {
  const { cronSecret } = getEnv();
  const header = request.headers.get('authorization') || '';
  if (!cronSecret || !header.startsWith('Bearer ') || !safeEqual(header.slice(7), cronSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}

// Throttle failed logins per IP: 5 failures per 15 minutes (DB when available, memory otherwise).
const memory = new Map();
export async function tooManyAttempts(ip) {
  if (dbConfigured()) {
    try {
      await ensureSchema();
      const rows = await query(`SELECT count(*)::int AS n FROM auth_attempts WHERE ip = $1 AND at > now() - ($2 || ' minutes')::interval`, [ip, String(WINDOW_MIN)]);
      return rows[0].n >= MAX_ATTEMPTS;
    } catch {
      /* fall through to memory */
    }
  }
  const list = (memory.get(ip) || []).filter((t) => t > Date.now() - WINDOW_MIN * 60000);
  memory.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}

export async function recordFailure(ip) {
  const list = memory.get(ip) || [];
  list.push(Date.now());
  memory.set(ip, list);
  if (dbConfigured()) {
    try {
      await query('INSERT INTO auth_attempts (ip) VALUES ($1)', [ip]);
      await query(`DELETE FROM auth_attempts WHERE at < now() - interval '1 day'`);
    } catch {
      /* ignore */
    }
  }
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 64);
}

export function sessionCookie(token, maxAgeSec = WEEK_MS / 1000) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}
