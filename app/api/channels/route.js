import { requireAdmin } from '@/lib/auth';
import { addChannel, addFeedChannel, removeChannel, setChannelHost } from '@/lib/channels';
import { fetchFeed } from '@/lib/rss';
import { newUnitCounter, resolveChannel } from '@/lib/youtube';
import { after } from 'next/server';
import { query } from '@/lib/db';
import { rescoreAndSave, refreshOneShow, runningRefresh, pipelineReady } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// A show was removed or a host name changed: rebuild the dashboard from the stored episodes right away. Costs no API quota.
async function rescoreNow() {
  try {
    return (await rescoreAndSave()).saved;
  } catch {
    return false; // the daily refresh will catch up
  }
}

const BUSY = { error: 'The dashboard is still updating from the last change. Try again in a minute.' };

async function recordUnits(units) {
  if (!units) return;
  try {
    await query(`INSERT INTO runs (kind, status, units_used, finished_at, stage) VALUES ('check','ok',$1, now(), 'validate')`, [units]);
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
    if (b.action === 'preview-feed') {
      const f = await fetchFeed(String(b.input || ''));
      return Response.json({ ok: true, channel: { title: f.title, thumbnail: null, episodes: f.items.length, latest: f.items[0]?.published_at || null } });
    }
    if (b.action === 'add-feed' || b.action === 'add') {
      if (await runningRefresh()) return Response.json(BUSY, { status: 409 });
      const ch = b.action === 'add-feed' ? await addFeedChannel(String(b.input || ''), String(b.host || '')) : await addChannel(String(b.input || ''), String(b.host || ''), counter);
      // Bring in the new show right away. It keeps working after this response is sent, so closing the page does not stop it.
      const started = Boolean(ch.id) && pipelineReady().ok;
      if (started) after(() => refreshOneShow(ch.id).catch(() => {}));
      return Response.json({ ok: true, channel: ch, refreshing: started });
    }
    if (b.action === 'remove') {
      if (await runningRefresh()) return Response.json(BUSY, { status: 409 });
      await removeChannel(b.id);
      return Response.json({ ok: true, rescored: await rescoreNow() });
    }
    if (b.action === 'host') {
      await setChannelHost(b.id, String(b.host || ''));
      return Response.json({ ok: true, rescored: await rescoreNow() });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err.message || err).slice(0, 160) }, { status: 400 });
  } finally {
    await recordUnits(counter.units);
  }
}
