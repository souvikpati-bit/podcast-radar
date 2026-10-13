import test from 'node:test';
import assert from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { __setTestClient, query } from '../lib/db.js';
import { addChannel } from '../lib/channels.js';
import { refreshStep, runRefreshToCompletion, refreshOneShow, runningRefresh, latestRefreshStatus } from '../lib/pipeline.js';
import { getDashboardData } from '../lib/snapshot.js';

const db = new PGlite();
__setTestClient(async (t, p) => (await db.query(t, p)).rows);
process.env.DATABASE_URL = 'postgres://test';
process.env.YOUTUBE_API_KEY = 'k';
delete process.env.GEMINI_API_KEY;

const DAY = 86400000;
const titles = (ch) => [
  ['AI agents with Jane Doe', 'We cover ai agents. Brought to you by Zenpay.'],
  ['Fundraising secrets with Sam Rivers', 'venture capital talk. Sponsored by Loomwork.'],
  ['Bootstrapping with Jane Doe', 'profitability. Use code SAVE'],
  ['Hiring lessons with Priya Nair', 'hiring and culture'],
  ['AI agents with Sam Rivers', 'ai agents, brought to you by Zenpay'],
  ['Pricing with Lee Chen', 'pricing and business model'],
].map(([t, d], i) => ({ id: `${ch}v${i}`, t, d, age: 5 + i * 4 }));

function fakeFetch(failChannel) {
  return async (url) => {
    const u = new URL(url);
    const ep = u.pathname.split('/').pop();
    if (ep === 'channels') {
      const h = u.searchParams.get('forHandle') || u.searchParams.get('id');
      if (h === failChannel) return { ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'forbidden' }] } }) };
      return { ok: true, json: async () => ({ items: [{ id: 'UC' + h.replace(/\W/g, '').padEnd(22, 'x').slice(0, 22), snippet: { title: `Show ${h}`, thumbnails: {} }, contentDetails: { relatedPlaylists: { uploads: `UU${h}` } } }] }) };
    }
    const ch = (u.searchParams.get('playlistId') || '').replace('UU', '') || 'x';
    if (ep === 'playlistItems') {
      return { ok: true, json: async () => ({ items: titles(ch).map((v) => ({ contentDetails: { videoId: v.id, videoPublishedAt: new Date(Date.now() - v.age * DAY).toISOString() } })) }) };
    }
    const ids = u.searchParams.get('id').split(',');
    const all = new Proxy({}, { get: (_, id) => titles(String(id).split('v')[0])[Number(String(id).split('v').pop())] });
    return { ok: true, json: async () => ({ items: ids.map((id) => ({ id, snippet: { title: all[id].t, description: all[id].d, publishedAt: new Date(Date.now() - all[id].age * DAY).toISOString(), liveBroadcastContent: 'none' }, statistics: { viewCount: '1000', likeCount: '40', commentCount: '4' }, contentDetails: { duration: 'PT40M' } })) }) };
  };
}

test('refresh pipeline end to end, resumable, with fallbacks', async () => {
  const f = fakeFetch('@broken');
  await addChannel('@aaa', 'Host A', undefined, f);
  await addChannel('@bbb', '', undefined, f);
  await db.query(`UPDATE channels SET uploads_playlist_id = NULL`); // force the resolve path
  await query('SELECT 1');

  // Before any refresh: demo fallback
  const before = await getDashboardData();
  assert.equal(before.kind, 'demo');

  // Step through manually to prove it is resumable
  let state = null;
  let last;
  let steps = 0;
  do {
    last = await refreshStep(state, f);
    state = last.state;
    steps++;
  } while (!last.done && steps < 50);
  assert.ok(last.done, JSON.stringify(last));
  assert.ok(steps >= 4, `expected several steps, got ${steps}`);

  const dash = await getDashboardData();
  assert.equal(dash.kind, 'live');
  assert.ok(dash.snapshot.results.topics.length >= 1);
  assert.ok(dash.snapshot.results.sponsors.length >= 1);
  const run = (await db.query(`SELECT * FROM runs WHERE kind='refresh' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.ok(run.units_used > 0);
  assert.equal(run.status, 'ok');

  // Second run: extraction cache means no re-extraction, snapshot still valid
  const cached = (await db.query('SELECT count(*)::int c FROM extractions')).rows[0].c;
  await runRefreshToCompletion({ fetchImpl: f });
  assert.equal((await db.query('SELECT count(*)::int c FROM extractions')).rows[0].c, cached);

  // One channel failing is skipped and recorded
  await db.query(`INSERT INTO channels (handle, youtube_channel_id, uploads_playlist_id, title) VALUES ('@broken','UCbroken','UUbrokenfail','Broken')`);
  const failingFetch = async (url, o) => (String(url).includes('UUbrokenfail') ? { ok: false, status: 404, json: async () => ({}) } : f(url, o));
  const r = await runRefreshToCompletion({ fetchImpl: failingFetch });
  assert.ok(r.done);
  const run2 = (await db.query(`SELECT * FROM runs WHERE kind='refresh' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.equal(run2.status, 'partial');
  assert.ok(JSON.stringify(run2.failures_json).includes('Broken'));
  assert.equal((await getDashboardData()).kind, 'live');

  // Removing the key: refresh is skipped, snapshot stays
  delete process.env.YOUTUBE_API_KEY;
  const skipped = await refreshStep(null, f);
  assert.ok(skipped.skipped);
  const after = await getDashboardData();
  assert.equal(after.kind, 'snapshot');
  assert.ok(after.snapshot.results.topics.length >= 1);
  process.env.YOUTUBE_API_KEY = 'k';
});

test('database failure falls back to demo data', async () => {
  __setTestClient(async () => {
    throw new Error('db down');
  });
  const d = await getDashboardData();
  assert.equal(d.kind, 'demo');
  assert.equal(d.snapshot.results.topics.length, 6);
});

test('a refresh where every channel fails keeps the previous snapshot', async () => {
  const d2 = new PGlite();
  __setTestClient(async (t, p) => (await d2.query(t, p)).rows);
  process.env.DATABASE_URL = 'postgres://test';
  process.env.YOUTUBE_API_KEY = 'k';
  const good = fakeFetch('@none');
  await addChannel('@ccc', '', undefined, good);
  await runRefreshToCompletion({ fetchImpl: good });
  const before = await getDashboardData();
  assert.equal(before.kind, 'live');
  const allFail = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await d2.query(`UPDATE channels SET uploads_playlist_id = 'UUx'`);
  const r = await runRefreshToCompletion({ fetchImpl: allFail });
  assert.ok(r.done);
  const run = (await d2.query(`SELECT status FROM runs WHERE kind='refresh' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.equal(run.status, 'partial'); // stored videos still score; the failure is recorded
  const after = await getDashboardData();
  assert.ok(after.snapshot.results.counts.videos > 0, 'empty snapshot must not replace the good one');
  assert.ok(after.snapshot.meta.failedChannels.length > 0);
  // a channel preview must not hide the failed refresh
  await d2.query(`INSERT INTO runs (kind, status, units_used) VALUES ('check','ok',1)`);
  assert.ok((await getDashboardData()).snapshot.meta.failedChannels.length > 0);
});

test('adding a show reads only that show, notes how many guest episodes it found, and is safe to follow', async () => {
  const d3 = new PGlite();
  __setTestClient(async (t, p) => (await d3.query(t, p)).rows);
  process.env.DATABASE_URL = 'postgres://test';
  process.env.YOUTUBE_API_KEY = 'k';
  const f = fakeFetch('@none');
  const a = await addChannel('@old1', '', undefined, f);
  await runRefreshToCompletion({ fetchImpl: f }); // the existing show is already in
  const unitsBefore = (await d3.query('SELECT COALESCE(SUM(units_used),0)::int u FROM runs')).rows[0].u;
  const oldVideos = (await d3.query('SELECT count(*)::int c FROM videos')).rows[0].c;
  const b = await addChannel('@newone', 'Host New', undefined, f);
  assert.ok(b.id && b.id !== a.id, 'adding a show returns its id');

  assert.equal(await runningRefresh(), null);
  const calls = [];
  const spy = async (url, o) => (calls.push(String(url)), f(url, o));
  const out = await refreshOneShow(b.id, { fetchImpl: spy });
  assert.ok(out.done, JSON.stringify(out));
  // it asked YouTube about the new show only
  assert.ok(calls.some((u) => u.includes('newone')), 'the new show was read');
  assert.ok(!calls.some((u) => u.includes('old1')), 'the other show was not read again');
  const newVideos = (await d3.query('SELECT count(*)::int c FROM videos WHERE channel_id = $1', [b.id])).rows[0].c;
  assert.ok(newVideos > 0, 'the new show has episodes');
  assert.equal((await d3.query('SELECT count(*)::int c FROM videos')).rows[0].c, oldVideos + newVideos);

  const st = await latestRefreshStatus();
  assert.equal(st.running, false);
  assert.equal(st.status, 'ok');
  assert.match(st.notes.join(' '), /guest episodes? found in the last 6 months|no guest episodes found/);
  const units = (await d3.query('SELECT COALESCE(SUM(units_used),0)::int u FROM runs')).rows[0].u - unitsBefore;
  assert.ok(units > 0 && units <= 8, `a single new show should cost only a few units, used ${units}`);
  assert.equal((await getDashboardData()).kind, 'live');
});
