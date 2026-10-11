// Snapshots and the fallback chain: live snapshot -> last good snapshot -> bundled demo data.
import cfg from '../config/pipeline.json' with { type: 'json' };
import { query, safeQuery } from './db.js';
import { buildDemoDataset } from './demo.js';
import { buildResults } from './scoring.js';

export async function saveSnapshot(payload, source = 'live') {
  await query('INSERT INTO seed_snapshot (payload_json, source) VALUES ($1::jsonb, $2)', [JSON.stringify(payload), source]);
  await query(`DELETE FROM seed_snapshot WHERE source = $1 AND id NOT IN (SELECT id FROM seed_snapshot WHERE source = $1 ORDER BY id DESC LIMIT 5)`, [source]);
}

export function demoSnapshot(now = new Date()) {
  const ds = buildDemoDataset(now);
  return { label: 'demo', generated_at: now.toISOString(), results: buildResults(ds.videos, now), meta: { channelsMonitored: ds.channels.length, failedChannels: [] } };
}

// Returns { snapshot, kind: 'live'|'snapshot'|'demo', ageHours, stale, lastRun, note }
export async function getDashboardData(now = new Date()) {
  const snap = await safeQuery(`SELECT payload_json, source, captured_at FROM seed_snapshot WHERE source IN ('live','captured') ORDER BY captured_at DESC LIMIT 1`);
  const run = await safeQuery(`SELECT status, started_at, finished_at, failures_json FROM runs WHERE kind = 'refresh' ORDER BY id DESC LIMIT 1`);
  const lastRun = run.ok ? run.rows[0] || null : null;
  if (snap.ok && snap.rows[0]) {
    const row = snap.rows[0];
    const payload = row.payload_json;
    const ageHours = (now.getTime() - new Date(row.captured_at).getTime()) / 3600000;
    const failedNow = lastRun && (lastRun.status === 'failed' || lastRun.status === 'skipped') && new Date(lastRun.started_at) > new Date(row.captured_at);
    return {
      snapshot: payload,
      kind: failedNow ? 'snapshot' : row.source === 'captured' ? 'snapshot' : 'live',
      capturedAt: new Date(row.captured_at).toISOString(),
      ageHours,
      stale: ageHours > cfg.staleHours,
      lastRun,
      note: failedNow ? 'The latest refresh failed, so this is the last good snapshot.' : null,
    };
  }
  const snapshot = demoSnapshot(now);
  return { snapshot, kind: 'demo', capturedAt: snapshot.generated_at, ageHours: 0, stale: false, lastRun, note: snap.ok ? 'No live data has been collected yet.' : `Database not available: ${snap.error}` };
}
