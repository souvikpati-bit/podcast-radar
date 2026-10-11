import test from 'node:test';
import assert from 'node:assert';
import { parseChannelInput, fetchChannelVideos, resolveChannel, newUnitCounter, mapVideo } from '../lib/youtube.js';
import { buildDemoDataset } from '../lib/demo.js';
import { normalizeGuestName, normalizeBrandName, brandDenied, cleanDescription, hasPaidSignal, parseDurationSeconds } from '../lib/text.js';

process.env.YOUTUBE_API_KEY = 'TESTKEY_SHOULD_NEVER_APPEAR_IN_URL';

test('parseChannelInput accepts handle, URL and id', () => {
  assert.deepEqual(parseChannelInput('@foo'), { type: 'handle', value: '@foo' });
  assert.deepEqual(parseChannelInput('foo'), { type: 'handle', value: '@foo' });
  assert.deepEqual(parseChannelInput('https://www.youtube.com/@bar.baz'), { type: 'handle', value: '@bar.baz' });
  const id = 'UC' + 'a'.repeat(22);
  assert.deepEqual(parseChannelInput(`https://youtube.com/channel/${id}`), { type: 'id', value: id });
  assert.deepEqual(parseChannelInput(id), { type: 'id', value: id });
  assert.equal(parseChannelInput('   '), null);
  assert.equal(parseChannelInput('not a handle!!'), null);
});

function fakeFetch(log) {
  return async (url, opts) => {
    log.push({ url: String(url), headers: opts.headers });
    const u = new URL(url);
    const ep = u.pathname.split('/').pop();
    if (ep === 'channels') {
      return { ok: true, json: async () => ({ items: [{ id: 'UC' + 'x'.repeat(22), snippet: { title: 'Show', thumbnails: { default: { url: 't' } } }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] }) };
    }
    if (ep === 'playlistItems') {
      const now = Date.now();
      const items = Array.from({ length: 12 }, (_, i) => ({ contentDetails: { videoId: 'v' + i, videoPublishedAt: new Date(now - i * 86400000).toISOString() } }));
      return { ok: true, json: async () => ({ items }) };
    }
    const ids = u.searchParams.get('id').split(',');
    return {
      ok: true,
      json: async () => ({
        items: ids.map((id, i) => ({
          id,
          snippet: { title: 'T ' + id, description: 'desc https://x.com sponsored by Foo', publishedAt: new Date().toISOString(), liveBroadcastContent: 'none' },
          statistics: { viewCount: String(1000 + i), likeCount: i === 0 ? undefined : '10', commentCount: '2' },
          contentDetails: { duration: 'PT45M10S' },
        })),
      }),
    };
  };
}

test('fetch returns videos, counts units, never puts key in URL', async () => {
  const log = [];
  const counter = newUnitCounter();
  const ch = await resolveChannel('@show', counter, fakeFetch(log));
  assert.equal(ch.uploads_playlist_id, 'UU1');
  const vids = await fetchChannelVideos(ch.uploads_playlist_id, counter, { fetchImpl: fakeFetch(log) });
  assert.equal(vids.length, 12);
  assert.equal(counter.units, 3); // channels + playlistItems + videos
  assert.ok(log.every((l) => !l.url.includes('TESTKEY')));
  assert.ok(log.every((l) => l.headers['x-goog-api-key']));
  assert.ok(!log.some((l) => l.url.includes('/search')));
  assert.equal(vids[0].likes, null); // hidden likes stay null, not 0
  assert.equal(vids[1].likes, 10);
});

test('mapVideo marks Shorts and parses duration', () => {
  const v = mapVideo({ id: 'a', snippet: { title: 't', publishedAt: '2026-01-01T00:00:00Z' }, contentDetails: { duration: 'PT50S' }, statistics: {} });
  assert.equal(v.is_short, true);
  assert.equal(v.views, null);
  assert.equal(parseDurationSeconds('PT1H2M3S'), 3723);
});

test('demo dataset has about 120 videos and is labelled demo', () => {
  const d = buildDemoDataset(new Date('2026-10-11T00:00:00Z'));
  assert.ok(d.videos.length >= 110 && d.videos.length <= 135, `got ${d.videos.length}`);
  assert.equal(d.label, 'demo');
  assert.equal(d.channels.length, 10);
});

test('text normalisation', () => {
  assert.equal(normalizeGuestName('Dr. José García'), 'Jose Garcia');
  assert.equal(normalizeGuestName('ft. mr john smith'), 'John Smith');
  assert.equal(normalizeGuestName('Madonna'), null);
  assert.equal(normalizeBrandName('Zenpay Inc.'), 'Zenpay');
  assert.ok(brandDenied('YouTube'));
  assert.ok(!brandDenied('Zenpay'));
  assert.ok(hasPaidSignal('This episode is brought to you by Foo'));
  assert.ok(!hasPaidSignal('We love Foo'));
  const c = cleanDescription('Hello https://a.com\n0:00 intro\nSubscribe now\nReal text');
  assert.ok(!c.includes('http') && !c.includes('0:00') && c.includes('Real text'));
});
