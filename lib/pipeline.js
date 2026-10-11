// Staged, resumable refresh pipeline: init -> fetch (a few channels per call) -> extract (one Gemini batch per call) -> score.
// Each step is short so it fits inside a serverless time limit. The caller (button or cron) repeats until done.
import cfg from '../config/pipeline.json' with { type: 'json' };
import { query, safeQuery } from './db.js';
import { getEnv } from './env.js';
import { listChannels, seedDefaultChannels } from './channels.js';
import { fetchChannelVideos, newUnitCounter, resolveChannel, YouTubeError } from './youtube.js';
import { extractVideos, PROMPT_VERSION } from './extract.js';
import { geminiAvailable } from './gemini.js';
import { defaultTaxonomy } from './taxonomy.js';
import { mergeGuestNames } from './guests.js';
import { normKey } from './text.js';
import { buildResults } from './scoring.js';
import { saveSnapshot } from './snapshot.js';

const CHANNELS_PER_STEP = 3;

export function pipelineReady() {
  const e = getEnv();
  if (!e.databaseUrl) return { ok: false, reason: 'DATABASE_URL is not set, so nothing can be stored' };
  if (!e.youtubeKey) return { ok: false, reason: 'YOUTUBE_API_KEY is not set, so live data cannot be fetched' };
  return { ok: true };
}

async function bulkInsert(table, cols, rows, conflict) {
  if (!rows.length) return;
  const per = 40;
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const params = [];
    const values = chunk.map((r) => `(${r.map((v) => (params.push(v), `$${params.length}`)).join(',')})`);
    await query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')} ${conflict}`, params);
  }
}

async function addFailure(runId, failure) {
  await query(`UPDATE runs SET failures_json = failures_json || $1::jsonb WHERE id = $2`, [JSON.stringify([failure]), runId]);
}

async function addUsage(runId, { units = 0, videos = 0, gemini = 0 }) {
  await query(`UPDATE runs SET units_used = units_used + $1, videos_fetched = videos_fetched + $2, gemini_calls = gemini_calls + $3 WHERE id = $4`, [units, videos, gemini, runId]);
}

export async function unitsUsedToday() {
  const r = await safeQuery(`SELECT COALESCE(SUM(units_used),0)::int AS u FROM runs WHERE started_at >= date_trunc('day', now() at time zone 'utc')`);
  return r.ok ? r.rows[0].u : 0;
}

async function finishRun(runId, status, stage) {
  await query(`UPDATE runs SET status = $1, finished_at = now(), stage = $2 WHERE id = $3`, [status, stage, runId]);
}

// One step. `state` is null to start. Returns { state, done, progress, error }.
export async function refreshStep(state, fetchImpl = fetch) {
  const ready = pipelineReady();
  if (!ready.ok && !state) {
    const run = await query(`INSERT INTO runs (kind, status, stage, finished_at, failures_json) VALUES ('refresh','skipped','init', now(), $1::jsonb) RETURNING id`, [JSON.stringify([{ channel: '-', reason: ready.reason }])]);
    return { state: null, done: true, skipped: true, progress: { stage: 'skipped', pct: 100, label: ready.reason }, runId: run?.[0]?.id, error: ready.reason };
  }
  if (!state) {
    const used = await unitsUsedToday();
    if (used >= cfg.dailyUnitHardStop) {
      return { state: null, done: true, skipped: true, progress: { stage: 'skipped', pct: 100, label: 'Daily YouTube budget reached' }, error: `Daily YouTube budget reached (${used} units)` };
    }
    const run = await query(`INSERT INTO runs (kind, status, stage) VALUES ('refresh','running','init') RETURNING id`);
    state = { runId: run[0].id, stage: 'init', cursor: 0 };
  }
  try {
    if (state.stage === 'init') return await stepInit(state, fetchImpl);
    if (state.stage === 'fetch') return await stepFetch(state, fetchImpl);
    if (state.stage === 'extract') return await stepExtract(state, fetchImpl);
    if (state.stage === 'score') return await stepScore(state);
    throw new Error(`Unknown stage ${state.stage}`);
  } catch (err) {
    const reason = String(err.message || err).slice(0, 200);
    await addFailure(state.runId, { channel: '-', reason });
    await finishRun(state.runId, 'failed', state.stage);
    return { state: null, done: true, failed: true, progress: { stage: 'failed', pct: 100, label: reason }, runId: state.runId, error: reason };
  }
}

async function stepInit(state, fetchImpl) {
  const counter = newUnitCounter();
  await seedDefaultChannels(counter, fetchImpl);
  await addUsage(state.runId, { units: counter.units });
  const ch = await listChannels({ onlyActive: true });
  if (!ch.rows.length) throw new Error('No channels to monitor. Add channels in Settings.');
  return { state: { ...state, stage: 'fetch', cursor: 0 }, done: false, progress: { stage: 'fetch', pct: 5, label: `Checking ${ch.rows.length} channels` } };
}

async function stepFetch(state, fetchImpl) {
  const ch = (await listChannels({ onlyActive: true })).rows;
  const slice = ch.slice(state.cursor, state.cursor + CHANNELS_PER_STEP);
  const counter = newUnitCounter();
  let fetched = 0;
  let quota = false;
  for (const c of slice) {
    try {
      let playlist = c.uploads_playlist_id;
      if (!playlist) {
        const r = await resolveChannel(c.youtube_channel_id || c.handle, counter, fetchImpl);
        playlist = r.uploads_playlist_id;
        await query(`UPDATE channels SET youtube_channel_id=$1, uploads_playlist_id=$2, title=$3, thumbnail=$4 WHERE id=$5`, [r.youtube_channel_id, playlist, r.title, r.thumbnail, c.id]);
      }
      const vids = await fetchChannelVideos(playlist, counter, { fetchImpl });
      await saveVideos(c.id, vids);
      fetched += vids.length;
    } catch (err) {
      const reason = String(err.message || err).slice(0, 160);
      await addFailure(state.runId, { channel: c.title || c.handle, reason });
      if (err instanceof YouTubeError && err.code === 'quota') {
        quota = true;
        break;
      }
    }
  }
  await addUsage(state.runId, { units: counter.units, videos: fetched });
  const next = state.cursor + CHANNELS_PER_STEP;
  if (quota || next >= ch.length) return { state: { ...state, stage: 'extract', cursor: 0 }, done: false, progress: { stage: 'extract', pct: 40, label: quota ? 'YouTube quota reached, using stored videos' : 'Reading video text' } };
  return { state: { ...state, cursor: next }, done: false, progress: { stage: 'fetch', pct: 5 + Math.round((next / ch.length) * 35), label: `Fetched ${Math.min(next, ch.length)} of ${ch.length} channels` } };
}

async function saveVideos(channelId, vids) {
  const rows = vids.map((v) => [v.video_id, channelId, v.title, v.description_clean, v.description_raw, JSON.stringify(v.tags || []), v.published_at, v.duration_s, v.is_short, v.url]);
  await bulkInsert(
    'videos',
    ['video_id', 'channel_id', 'title', 'description_clean', 'description_raw', 'tags', 'published_at', 'duration_s', 'is_short', 'url'],
    rows,
    `ON CONFLICT (video_id) DO UPDATE SET title=EXCLUDED.title, description_clean=EXCLUDED.description_clean, description_raw=EXCLUDED.description_raw, tags=EXCLUDED.tags, is_short=EXCLUDED.is_short, duration_s=EXCLUDED.duration_s`,
  );
  const today = new Date().toISOString().slice(0, 10);
  await bulkInsert('video_stats', ['video_id', 'captured_on', 'views', 'likes', 'comments'], vids.map((v) => [v.video_id, today, v.views, v.likes, v.comments]), `ON CONFLICT (video_id, captured_on) DO UPDATE SET views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments`);
}

export async function loadTaxonomy() {
  const r = await safeQuery('SELECT canonical_name, aliases FROM topics_taxonomy');
  if (r.ok && r.rows.length) return r.rows.map((x) => ({ canonical_name: x.canonical_name, aliases: x.aliases || [] }));
  const tax = defaultTaxonomy();
  if (r.ok) {
    for (const t of tax) await query('INSERT INTO topics_taxonomy (canonical_name, aliases) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING', [t.canonical_name, JSON.stringify(t.aliases)]);
  }
  return tax;
}

async function stepExtract(state, fetchImpl) {
  const remainingCap = cfg.maxNewVideosPerRun - state.cursor;
  const take = Math.min(cfg.geminiBatchSize, remainingCap);
  let rows = [];
  if (take > 0) {
    rows = await query(
      `SELECT v.video_id, v.title, v.description_clean, v.description_raw, v.tags, c.host_name
       FROM videos v JOIN channels c ON c.id = v.channel_id
       LEFT JOIN extractions e ON e.video_id = v.video_id AND e.prompt_version = $1
       WHERE (e.video_id IS NULL OR (e.method = 'keyword' AND $4::boolean)) AND v.is_short = FALSE AND c.active = TRUE
         AND v.published_at > now() - ($2 || ' days')::interval
       ORDER BY v.published_at DESC LIMIT $3`,
      [PROMPT_VERSION, String(cfg.extractWindowDays), take, geminiAvailable()],
    );
  }
  if (!rows.length) return { state: { ...state, stage: 'score', cursor: 0 }, done: false, progress: { stage: 'score', pct: 85, label: 'Scoring' } };
  const ch = (await listChannels()).rows;
  const ctx = { taxonomy: await loadTaxonomy(), hostNames: ch.map((c) => c.host_name).filter(Boolean), extraDenied: ch.map((c) => c.title).filter(Boolean) };
  const counter = { gemini: 0 };
  let geminiError = null;
  ctx.onGeminiError = (e) => (geminiError = e);
  const videos = rows.map((r) => ({ ...r, tags: r.tags || [] }));
  const result = await extractVideos(videos, ctx, counter, { fetchImpl });
  const out = [...result].map(([id, r]) => [id, PROMPT_VERSION, JSON.stringify(r.guests), JSON.stringify(r.topics), JSON.stringify(r.brands), r.method]);
  await bulkInsert('extractions', ['video_id', 'prompt_version', 'guests', 'topics', 'brands', 'method'], out, 'ON CONFLICT (video_id, prompt_version) DO UPDATE SET guests=EXCLUDED.guests, topics=EXCLUDED.topics, brands=EXCLUDED.brands, method=EXCLUDED.method, created_at=now()');
  await addUsage(state.runId, { gemini: counter.gemini });
  if (geminiError) await addFailure(state.runId, { channel: 'Gemini', reason: `${String(geminiError.message).slice(0, 120)} (used keyword fallback)` });
  const cursor = state.cursor + rows.length;
  return { state: { ...state, cursor }, done: false, progress: { stage: 'extract', pct: 40 + Math.min(45, Math.round((cursor / cfg.maxNewVideosPerRun) * 45)), label: `Read ${cursor} new videos` } };
}

// Turn stored rows into the dataset the scoring functions expect.
export async function loadDataset(now = new Date()) {
  const ch = (await listChannels()).rows;
  const hosts = ch.map((c) => normKey(c.host_name)).filter(Boolean);
  const rows = await query(
    `SELECT v.video_id, v.channel_id, c.title AS channel_title, v.title, v.url, v.published_at, v.is_short,
            s.views, s.likes, s.comments, e.guests, e.topics, e.brands
     FROM videos v
     JOIN channels c ON c.id = v.channel_id AND c.active = TRUE
     LEFT JOIN LATERAL (SELECT views, likes, comments FROM video_stats WHERE video_id = v.video_id ORDER BY captured_on DESC LIMIT 1) s ON TRUE
     LEFT JOIN extractions e ON e.video_id = v.video_id AND e.prompt_version = $1
     WHERE v.published_at > now() - interval '90 days'`,
    [PROMPT_VERSION],
  );
  const aliasRows = (await safeQuery('SELECT alias_key, canonical_name FROM guest_aliases')).rows;
  const aliasMap = Object.fromEntries(aliasRows.map((a) => [a.alias_key, a.canonical_name]));
  const names = [...new Set(rows.flatMap((r) => r.guests || []))].sort();
  const merged = mergeGuestNames(names, aliasMap);
  const videos = rows.map((r) => ({
    video_id: r.video_id,
    channel_key: String(r.channel_id),
    channel_title: r.channel_title,
    title: r.title,
    url: r.url,
    published_at: new Date(r.published_at).toISOString(),
    views: r.views === null || r.views === undefined ? null : Number(r.views),
    likes: r.likes === null || r.likes === undefined ? null : Number(r.likes),
    comments: r.comments === null || r.comments === undefined ? null : Number(r.comments),
    is_short: r.is_short,
    guests: [...new Set((r.guests || []).map((g) => merged.map[g] || g).filter((g) => !hosts.includes(normKey(g))))],
    topics: r.topics || [],
    brands: r.brands || [],
  }));
  return { videos, ambiguous: merged.ambiguous, channelCount: ch.filter((c) => c.active).length, now };
}

async function stepScore(state) {
  const now = new Date();
  const ds = await loadDataset(now);
  const results = buildResults(ds.videos, now);
  const run = (await query('SELECT failures_json, units_used, gemini_calls, videos_fetched FROM runs WHERE id = $1', [state.runId]))[0];
  const failedChannels = (run.failures_json || []).filter((f) => f.channel && f.channel !== '-' && f.channel !== 'Gemini');
  if (results.counts.videos === 0) {
    // Never store an empty snapshot: the dashboard keeps the last good one (or demo data).
    await addFailure(state.runId, { channel: '-', reason: 'No videos were available, so the previous snapshot is kept' });
    await finishRun(state.runId, 'failed', 'done');
    return { state: null, done: true, failed: true, progress: { stage: 'failed', pct: 100, label: 'No videos were available. Kept the previous data.' }, runId: state.runId, error: 'No videos were available. Kept the previous data.' };
  }
  await saveSnapshot({ label: 'live', generated_at: now.toISOString(), results, meta: { channelsMonitored: ds.channelCount, failedChannels, ambiguousGuests: ds.ambiguous.slice(0, 20) } }, 'live');
  const status = results.counts.videos === 0 ? 'failed' : failedChannels.length ? 'partial' : 'ok';
  await finishRun(state.runId, status, 'done');
  return { state: null, done: true, progress: { stage: 'done', pct: 100, label: `Done: ${results.counts.videos} videos from ${results.counts.channels} channels` }, runId: state.runId, status };
}

// Server-side loop used by cron: run steps until done or the time budget runs out.
export async function runRefreshToCompletion({ budgetMs = 240000, fetchImpl = fetch } = {}) {
  const started = Date.now();
  let state = null;
  let last;
  for (let i = 0; i < 200; i++) {
    last = await refreshStep(state, fetchImpl);
    if (last.done) return last;
    state = last.state;
    if (Date.now() - started > budgetMs) return { ...last, done: false, timedOut: true };
  }
  return last;
}
