import { getEnv } from './env.js';
import { recordFailure, safeEqual, tooManyAttempts } from './auth.js';

export async function checkLogin(ip, key) {
  if (await tooManyAttempts(ip)) return { ok: false, status: 429, error: 'Too many attempts. Try again in 15 minutes.' };
  if (!key || !safeEqual(key, getEnv().adminKey)) {
    await recordFailure(ip);
    return { ok: false, status: 401, error: 'Wrong key' };
  }
  return { ok: true };
}
