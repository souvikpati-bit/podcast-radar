import { requireAdmin } from '@/lib/auth';
import { saveProfile, removeProfile } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

// Aditya pastes a founder's real profile link once; it is remembered. Admin only.
export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let b = {};
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  try {
    if (b.action === 'remove') {
      await removeProfile(String(b.guest || ''), String(b.network || ''));
      return Response.json({ ok: true });
    }
    const p = await saveProfile(String(b.guest || ''), String(b.url || ''));
    return Response.json({ ok: true, network: p.network, url: p.url });
  } catch (err) {
    return Response.json({ error: String(err.message || err).slice(0, 140) }, { status: 400 });
  }
}
