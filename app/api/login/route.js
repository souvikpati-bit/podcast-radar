import { getEnv } from '@/lib/env';
import { checkLogin } from '@/lib/login';
import { clientIp, makeToken, sessionCookie } from '@/lib/auth';

export async function POST(request) {
  if (!getEnv().adminKey) return Response.json({ error: 'Settings are locked: ADMIN_KEY is not set' }, { status: 401 });
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  const result = await checkLogin(clientIp(request), String(body.key || '').slice(0, 200));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(makeToken()) } });
}
