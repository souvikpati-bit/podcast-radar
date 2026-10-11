import test from 'node:test';
import assert from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { __setTestClient } from '../lib/db.js';
import { parseFeed, assertPublicUrl, fetchFeed } from '../lib/rss.js';
import { addFeedChannel } from '../lib/channels.js';
import { runRefreshToCompletion } from '../lib/pipeline.js';
import { getDashboardData } from '../lib/snapshot.js';

const day = (n) => new Date(Date.now() - n * 86400000).toUTCString();
const XML = `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="x" xmlns:content="y"><channel><title>The Founder Show &amp; Co</title>
<item><title>How AI agents change sales with Jane Doe</title><link>https://ex.com/1</link><guid>g1</guid><pubDate>${day(5)}</pubDate><itunes:duration>45:10</itunes:duration>
<description><![CDATA[<p>Guest: <b>Jane Doe</b>, founder of Foo. This episode is brought to you by Zenpay.</p>]]></description></item>
<item><title>Trailer</title><guid>g2</guid><pubDate>${day(6)}</pubDate><itunes:duration>00:50</itunes:duration></item>
<item><title>Fundraising lessons with Sam Rivers</title><link>https://ex.com/3</link><guid>g3</guid><pubDate>${day(9)}</pubDate><itunes:duration>3000</itunes:duration>
<content:encoded><![CDATA[<p>Sponsored by Loomwork. Sam Rivers talks venture capital.</p>]]></content:encoded></item>
<item><title>Old one with Bob Ray</title><guid>g4</guid><pubDate>${day(400)}</pubDate><itunes:duration>40:00</itunes:duration></item>
</channel></rss>`;

test('RSS parser: entities, CDATA, HTML stripping, durations, ids', () => {
  const f = parseFeed(XML);
  assert.equal(f.title, 'The Founder Show & Co');
  assert.equal(f.items.length, 4);
  assert.match(f.items[0].description_raw, /Guest: Jane Doe, founder of Foo\. This episode is brought to you by Zenpay\./);
  assert.ok(!f.items[0].description_raw.includes('<b>'));
  assert.equal(f.items[0].duration_s, 45 * 60 + 10);
  assert.equal(f.items[2].duration_s, 3000);
  assert.match(f.items[2].description_raw, /Sponsored by Loomwork/);
  assert.ok(f.items.every((i) => i.video_id.startsWith('rss:')));
  assert.notEqual(f.items[0].video_id, f.items[1].video_id);
});

test('RSS fetch only allows public http(s) links', async () => {
  for (const bad of ['http://localhost/feed', 'http://127.0.0.1/x', 'http://192.168.1.5/x', 'http://169.254.169.254/latest', 'ftp://example.com/x', 'file:///etc/passwd', 'http://[::1]/x', 'not a url', 'http://intranet/x']) {
    assert.throws(() => assertPublicUrl(bad), undefined, bad);
  }
  assert.ok(assertPublicUrl('https://feeds.example.com/show.rss'));
  await assert.rejects(() => fetchFeed('https://a.example.com/x', async () => ({ ok: true, text: async () => '<rss><channel><title>t</title></channel></rss>' })), /No episodes/);
});

test('an RSS-only show flows through refresh: no YouTube quota, guests and sponsors extracted', async () => {
  const db = new PGlite();
  __setTestClient(async (t, p) => (await db.query(t, p)).rows);
  Object.assign(process.env, { DATABASE_URL: 'postgres://t', YOUTUBE_API_KEY: 'k' });
  delete process.env.GEMINI_API_KEY;
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => XML });
  const added = await addFeedChannel('https://feeds.example.com/show.rss', 'Host Person', fetchImpl);
  assert.equal(added.title, 'The Founder Show & Co');
  await assert.rejects(() => addFeedChannel('https://feeds.example.com/show.rss', '', fetchImpl), /already/);
  const r = await runRefreshToCompletion({ fetchImpl });
  assert.ok(r.done);
  const run = (await db.query("SELECT units_used, status FROM runs WHERE kind='refresh' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.equal(run.units_used, 0, 'RSS uses no YouTube quota');
  const stored = (await db.query("SELECT title FROM videos ORDER BY published_at DESC")).rows.map((x) => x.title);
  assert.deepEqual(stored, ['How AI agents change sales with Jane Doe', 'Fundraising lessons with Sam Rivers']); // trailer (<10 min) and the 400-day-old episode are skipped
  const d = await getDashboardData();
  assert.equal(d.kind, 'live');
  const res = d.snapshot.results;
  assert.ok(res.counts.videos >= 1);
  const guests = Object.values(res.guestsByTopic).flat().map((g) => g.guest);
  assert.ok(guests.includes('Jane Doe') || guests.includes('Sam Rivers'));
  assert.ok(res.sponsors.some((s) => /Zenpay|Loomwork/.test(s.brand)));
});
