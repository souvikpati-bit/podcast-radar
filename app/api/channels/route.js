import { requireAdmin } from '@/lib/auth';
import { addChannel, removeChannel, setChannelHost } from '@/lib/channels';
import { newUnitCounter, resolveChannel } from '@/lib/youtube';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function recordUnits(units) {
  if (!units) return;
  try {
    await query(`INSERT INTO runs (kind, status, units_used, finished_at, stage) VALUES ('refresh','channel-check',$1, now(), 'validate')`, [units]);
  } catch {
    /* quota bookkeeping is best effort */
  }
}

export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let b = {};
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const counter = newUnitCounter();
  try {
    if (b.action === 'preview') {
      const ch = await resolveChannel(String(b.input || ''), counter);
      return Response.json({ ok: true, channel: ch });
    }
    if (b.action === 'add') {
      const ch = await addChannel(String(b.input || ''), String(b.host || ''), counter);
      return Response.json({ ok: true, channel: ch });
    }
    if (b.action === 'remove') {
      await removeChannel(b.id);
      return Response.json({ ok: true });
    }
    if (b.action === 'host') {
      await setChannelHost(b.id, String(b.host || ''));
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err.message || err).slice(0, 160) }, { status: 400 });
  } finally {
    await recordUnits(counter.units);
  }
}
