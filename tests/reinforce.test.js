import test from 'node:test';
import assert from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { __setTestClient } from '../lib/db.js';
import { addChannel } from '../lib/channels.js';
import { runRefreshToCompletion } from '../lib/pipeline.js';
import { overlap, similarity, findFeedForShow, assessFeed } from '../lib/discover.js';

const day = (n) => new Date(Date.now() - n * 86400000);
const NAMES = ['Alex Brown', 'Casey Smith', 'Drew Jones', 'Evan Clark', 'Finn Lopez', 'Gabe Reyes', 'Hana Park', 'Ivy Chen'];
const item = (title, ago, mins = 40) => `<item><title>${title}</title><guid>${title}-${ago}</guid><pubDate>${day(ago).toUTCString()}</pubDate><itunes:duration>${mins * 60}</itunes:duration><description>Show notes for ${title}.</description></item>`;
const feed = (title, items) => `<rss version="2.0" xmlns:itunes="x"><channel><title>${title}</title>${items.join('')}</channel></rss>`;

const THIN_FEED = () => feed('The Thin Show', ['Fundraising secrets with Sam Rivers', ...NAMES.slice(0, 7).map((n, i) => `Building startups with ${n}`)].map((t, i) => item(t, 3 + i * 9)));
let newShowEpisodes = 8;
const NEW_FEED = () => feed('Another Founder Pod', NAMES.slice(0, newShowEpisodes).map((n, i) => `Scaling companies with ${n}`).map((t, i) => item(t, 4 + i * 10, 45)));
const BULLETIN = () => feed('Daily Market Bulletin', Array.from({ length: 150 }, (_, i) => item(`Market update ${i}`, i, 5)));

function router() {
  const calls = { itunes: [], youtube: 0, feeds: [] };
  const f = async (url) => {
    const u = new URL(String(url));
    if (u.hostname === 'itunes.apple.com') {
      const term = u.searchParams.get('term');
      calls.itunes.push(term);
      const results = term === 'The Thin Show'
        ? [{ collectionName: 'The Thin Show', artistName: 'Host Person', feedUrl: 'https://feeds.example.com/thin.rss' }]
        : [
            { collectionName: 'Another Founder Pod', artistName: 'Pat Doe', feedUrl: 'https://feeds.example.com/new.rss' },
            { collectionName: 'Daily Market Bulletin', artistName: 'News Desk', feedUrl: 'https://feeds.example.com/bulletin.rss' },
          ];
      return { ok: true, status: 200, json: async () => ({ results }) };
    }
    if (u.hostname === 'feeds.example.com') {
      calls.feeds.push(u.pathname);
      const xml = u.pathname === '/thin.rss' ? THIN_FEED() : u.pathname === '/new.rss' ? NEW_FEED() : BULLETIN();
      return { ok: true, status: 200, text: async () => xml };
    }
    // YouTube API
    calls.youtube++;
    const ep = u.pathname.split('/').pop();
    if (ep === 'channels') return { ok: true, status: 200, json: async () => ({ items: [{ id: 'UC' + 'z'.repeat(22), snippet: { title: 'The Thin Show', thumbnails: {} }, contentDetails: { relatedPlaylists: { uploads: 'UUthin' } } }] }) };
    if (ep === 'playlistItems') return { ok: true, status: 200, json: async () => ({ items: [{ contentDetails: { videoId: 'ytv1', videoPublishedAt: day(3).toISOString() } }, { contentDetails: { videoId: 'ytv2', videoPublishedAt: day(60).toISOString() } }] }) };
    return { ok: true, status: 200, json: async () => ({ items: [
      { id: 'ytv1', snippet: { title: 'Fundraising secrets with Sam Rivers | Thin Show', description: 'x', publishedAt: day(3).toISOString(), liveBroadcastContent: 'none' }, statistics: { viewCount: '900', likeCount: '30', commentCount: '3' }, contentDetails: { duration: 'PT45M' } },
      { id: 'ytv2', snippet: { title: 'Pricing lessons with Dana Wu', description: 'x', publishedAt: day(60).toISOString(), liveBroadcastContent: 'none' }, statistics: { viewCount: '500', likeCount: '20', commentCount: '2' }, contentDetails: { duration: 'PT50M' } },
    ] }) };
  };
  return { f, calls };
}

test('helpers: name similarity and same-episode overlap', () => {
  assert.ok(similarity('The Thin Show', 'The Thin Show') === 1);
  assert.ok(similarity('Raj Shamani', 'Figuring Out with Raj Shamani') < 0.75);
  assert.ok(overlap('Fundraising secrets with Sam Rivers | Thin Show', 'Fundraising secrets with Sam Rivers') >= 0.6);
  assert.ok(overlap('Totally different title about hiring', 'Fundraising secrets with Sam Rivers') < 0.3);
});

test('feed assessment rejects daily bulletins and tiny shows, accepts active long-form shows', async () => {
  const { f } = router();
  assert.equal((await assessFeed('https://feeds.example.com/bulletin.rss', f)).ok, false);
  assert.equal((await assessFeed('https://feeds.example.com/new.rss', f)).ok, true);
  assert.ok(await findFeedForShow('The Thin Show', f));
  assert.equal(await findFeedForShow('Some Show With No Match', f), null);
});

test('thin data is detected and reinforced from RSS automatically, with no manual input', async () => {
  const db = new PGlite();
  __setTestClient(async (t, p) => (await db.query(t, p)).rows);
  Object.assign(process.env, { DATABASE_URL: 'postgres://t', YOUTUBE_API_KEY: 'k' });
  delete process.env.GEMINI_API_KEY;
  const { f, calls } = router();
  await addChannel('@thinshow', 'Host Person', undefined, f);
  assert.equal((await db.query('SELECT feed_url FROM channels')).rows[0].feed_url, null);

  const r = await runRefreshToCompletion({ fetchImpl: f });
  assert.ok(r.done, JSON.stringify(r));

  const ch = (await db.query('SELECT title, feed_url, auto_added FROM channels ORDER BY id')).rows;
  assert.equal(ch[0].feed_url, 'https://feeds.example.com/thin.rss', 'the thin YouTube show got its podcast feed attached by itself');
  const auto = ch.find((c) => c.auto_added);
  assert.ok(auto, 'a new show was discovered because the overall data was thin');
  assert.equal(auto.title, 'Another Founder Pod');
  assert.ok(!ch.some((c) => /Bulletin/.test(c.title)), 'a daily news bulletin is not added');

  // The same episode from YouTube and the feed is counted once; the 7 new feed episodes are added.
  const thinRss = (await db.query("SELECT count(*)::int n FROM videos v JOIN channels c ON c.id=v.channel_id WHERE c.title='The Thin Show' AND v.video_id LIKE 'rss:%'")).rows[0].n;
  assert.equal(thinRss, 7);
  const notes = (await db.query("SELECT notes_json FROM runs WHERE kind='refresh' ORDER BY id DESC LIMIT 1")).rows[0].notes_json;
  assert.ok(notes.length >= 2 && notes.some((n) => /attached automatically/.test(n)) && notes.some((n) => /added automatically/.test(n)));
  assert.ok(calls.feeds.includes('/thin.rss') && calls.feeds.includes('/new.rss'));

  // Reinforcement used no extra YouTube calls in its second pass (RSS only).
  const ytBefore = calls.youtube;
  const guestsNow = (await db.query("SELECT count(*)::int n FROM extractions WHERE jsonb_array_length(guests) > 0")).rows[0].n;
  assert.ok(guestsNow >= 14);
  assert.ok(ytBefore > 0);

  // An auto-added show that stops delivering guest episodes is removed again and never retried.
  newShowEpisodes = 2;
  await db.query("UPDATE channels SET added_at = now() - interval '2 hours' WHERE auto_added");
  await db.query("DELETE FROM videos WHERE channel_id IN (SELECT id FROM channels WHERE auto_added)");
  const r2 = await runRefreshToCompletion({ fetchImpl: f });
  assert.ok(r2.done);
  assert.equal((await db.query('SELECT count(*)::int n FROM channels WHERE auto_added')).rows[0].n, 0, 'failing auto-added show was removed');
  assert.ok((await db.query('SELECT count(*)::int n FROM discovery_rejects')).rows[0].n >= 1, 'and remembered as rejected');
  const r3 = await runRefreshToCompletion({ fetchImpl: f });
  assert.ok(r3.done);
  assert.equal((await db.query('SELECT count(*)::int n FROM channels WHERE auto_added')).rows[0].n, 0, 'rejected shows are never re-added');
});
