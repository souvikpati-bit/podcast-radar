// Monitored-channel storage. Handles are resolved once and the IDs cached in the channels table.
import cfg from '../config/pipeline.json' with { type: 'json' };
import defaults from '../config/default-channels.json' with { type: 'json' };
import { safeQuery } from './db.js';
import { resolveChannel, newUnitCounter } from './youtube.js';

export async function listChannels({ onlyActive = false } = {}) {
  const r = await safeQuery(
    `SELECT id, handle, youtube_channel_id, uploads_playlist_id, title, thumbnail, host_name, active, added_at
     FROM channels ${onlyActive ? 'WHERE active = TRUE' : ''} ORDER BY id`,
  );
  return r;
}

export function cleanHost(s) {
  return String(s || '').replace(/[<>]/g, '').trim().slice(0, 80);
}

// Validate against the YouTube API (returns name + thumbnail so the user can confirm), then save.
export async function addChannel(input, hostName = '', counter = newUnitCounter(), fetchImpl = fetch) {
  const list = await listChannels();
  if (!list.ok) throw new Error(`Database unavailable: ${list.error}`);
  if (list.rows.length >= cfg.maxChannels) throw new Error(`You can monitor at most ${cfg.maxChannels} channels`);
  const ch = await resolveChannel(input, counter, fetchImpl);
  const dup = list.rows.find((c) => c.youtube_channel_id === ch.youtube_channel_id);
  if (dup) throw new Error(`${ch.title} is already in your list`);
  const ins = await safeQuery(
    `INSERT INTO channels (handle, youtube_channel_id, uploads_playlist_id, title, thumbnail, host_name)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (handle) DO NOTHING RETURNING id`,
    [ch.handle, ch.youtube_channel_id, ch.uploads_playlist_id, ch.title, ch.thumbnail, cleanHost(hostName)],
  );
  if (!ins.ok) throw new Error(ins.error);
  return { ...ch, host_name: cleanHost(hostName), units: counter.units };
}

export async function removeChannel(id) {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n)) throw new Error('Bad channel id');
  return safeQuery('DELETE FROM channels WHERE id = $1', [n]);
}

export async function setChannelHost(id, hostName) {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n)) throw new Error('Bad channel id');
  return safeQuery('UPDATE channels SET host_name = $1 WHERE id = $2', [cleanHost(hostName), n]);
}

// First run only: fill an empty channels table from the default list (each handle verified live).
export async function seedDefaultChannels(counter = newUnitCounter(), fetchImpl = fetch) {
  const list = await listChannels();
  if (!list.ok || list.rows.length > 0) return { seeded: 0, failed: [] };
  // Already ran before: do not re-add defaults the user deleted.
  const prior = await safeQuery("SELECT 1 FROM seed_snapshot WHERE source = 'live' LIMIT 1");
  if (prior.ok && prior.rows.length) return { seeded: 0, failed: [] };
  let seeded = 0;
  const failed = [];
  for (const d of defaults.channels) {
    try {
      await addChannel(d.handle, d.host_name, counter, fetchImpl);
      seeded += 1;
    } catch (err) {
      failed.push({ handle: d.handle, reason: String(err.message).slice(0, 120) });
    }
  }
  return { seeded, failed };
}
