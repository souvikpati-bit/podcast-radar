// Picks the shows that actually share founders. Reads recent episodes of many candidate podcast feeds (free),
// has Gemini read guests and roles, then finds the set of shows with the most founders on two or more shows within a month.
// Run: node --env-file=.env.local scripts/analyze-overlap.mjs
import disc from '../config/discovery.json' with { type: 'json' };
import { searchPodcasts } from '../lib/discover.js';
import { fetchFeed } from '../lib/rss.js';
import { extractVideos } from '../lib/extract.js';
import { defaultTaxonomy } from '../lib/taxonomy.js';
import { mergeGuestNames } from '../lib/guests.js';
import { normKey } from '../lib/text.js';

const DAYS = 60;
const MONTH = 30;
const EXTRA_QUERIES = ['startup podcast India', 'Indian founders podcast', 'entrepreneur interviews India', 'business podcast India', 'fintech India podcast', 'venture capital India podcast', 'SaaS India podcast', 'Indian startup ecosystem podcast', 'startup stories India', 'founder journey India'];
const SEEDS = [
  'https://rss.buzzsprout.com/1601695.rss', 'https://feeds.transistor.fm/first-principles-261f2954-4e6b-4315-973d-17d02efc10f6', 'https://feeds.simplecast.com/6dj1W8C2',
  'https://anchor.fm/s/991768/podcast/rss', 'https://anchor.fm/s/f5347ab0/podcast/rss', 'https://feeds.captivate.fm/prime-venture-partners/', 'https://media.rss.com/thebarbershopwithshantanu/feed.xml',
  'https://feeds.simplecast.com/7PWFZi_d', 'https://anchor.fm/s/db9d322c/podcast/rss', 'https://anchor.fm/s/b025ebc/podcast/rss',
];

const pool = new Map();
for (const q of [...disc.queries, ...EXTRA_QUERIES]) for (const r of await searchPodcasts(q)) pool.set(r.feedUrl, r);
for (const s of SEEDS) if (!pool.has(s)) pool.set(s, { name: '', artist: '', feedUrl: s });
console.log('candidate feeds:', pool.size);

const shows = [];
const errs = [];
const cutoff = Date.now() - DAYS * 86400000;
for (const [url, meta] of pool) {
  try {
    const feed = await fetchFeed(url);
    const eps = feed.items.filter((i) => new Date(i.published_at).getTime() >= cutoff && (i.duration_s === 0 || i.duration_s >= 900));
    if (eps.length >= 3 && eps.length <= 40) shows.push({ name: feed.title || meta.name, artist: meta.artist, url, eps });
  } catch (e) { errs.push(e.message); }
}
console.log('feed errors:', errs.length, [...new Set(errs)].slice(0, 3).join(' | '));
shows.sort((a, b) => b.eps.length - a.eps.length);
let total = 0;
const keep = [];
for (const s of shows) { if (total + s.eps.length > 420) break; keep.push(s); total += s.eps.length; }
console.log(`active candidate shows: ${shows.length}; reading ${keep.length} shows / ${total} episodes with Gemini`);

const counter = { gemini: 0 };
const ctx = { allowNewTopics: false, taxonomy: defaultTaxonomy(), hostNames: keep.map((s) => s.artist).filter(Boolean), newTopics: [] };
const videos = keep.flatMap((s) => s.eps.map((e) => ({ ...e, tags: [], show: s.name })));
const out = await extractVideos(videos, ctx, counter);
console.log('gemini calls:', counter.gemini);

// guest -> { shows: Map(show -> latest date), role }
const names = [...new Set(videos.flatMap((v) => out.get(v.video_id)?.guests || []))];
const merged = mergeGuestNames(names).map;
const guests = new Map();
for (const v of videos) {
  const x = out.get(v.video_id);
  for (const info of x?.guest_info || []) {
    const key = merged[info.name] || info.name;
    if (!guests.has(key)) guests.set(key, { eps: [], roles: [] });
    const g = guests.get(key);
    g.eps.push({ show: v.show, at: new Date(v.published_at).getTime() });
    if (info.role !== 'unknown') g.roles.push(info.role);
  }
}
const isFounder = (g) => { const f = g.roles.filter((r) => r === 'founder').length; return g.roles.length === 0 || f >= g.roles.length / 2; };
const monthShows = (g, set) => new Set(g.eps.filter((e) => Date.now() - e.at <= MONTH * 86400000 && (!set || set.has(e.show))).map((e) => e.show));

const showNames = keep.map((s) => s.name);
const founderEps = Object.fromEntries(showNames.map((n) => [n, 0]));
for (const [, g] of guests) if (isFounder(g)) for (const e of g.eps) founderEps[e.show]++;

// Greedy: grow a set of up to 10 shows, each step adding the show that creates the most founders on 2+ shows within a month.
const score = (set) => [...guests.values()].filter((g) => isFounder(g) && monthShows(g, set).size >= 2).length;
const chosen = new Set();
const eligible = showNames.filter((n) => founderEps[n] >= 4);
while (chosen.size < 10 && eligible.some((n) => !chosen.has(n))) {
  let best = null;
  for (const n of eligible) {
    if (chosen.has(n)) continue;
    const trial = new Set([...chosen, n]);
    const val = score(trial) * 1000 + founderEps[n];
    if (!best || val > best.val) best = { n, val };
  }
  chosen.add(best.n);
}
console.log('\nSHOWS (founder episodes in 60 days):');
for (const n of showNames.sort((a, b) => founderEps[b] - founderEps[a])) console.log(`  ${String(founderEps[n]).padStart(3)} | ${n}${chosen.has(n) ? '   <== chosen' : ''}`);
console.log(`\nfounders on 2+ of ALL candidate shows within ${MONTH} days: ${score(new Set(showNames))}`);
console.log(`founders on 2+ of the CHOSEN ${chosen.size} shows within ${MONTH} days: ${score(chosen)}`);
for (const [name, g] of guests) {
  const s = monthShows(g, chosen);
  if (isFounder(g) && s.size >= 2) console.log(`  media round: ${name} -> ${[...s].join(' + ')}`);
}
console.log('\nCHOSEN (feeds):');
for (const s of keep.filter((x) => chosen.has(x.name))) console.log(`  ${s.name} | ${s.artist} | ${s.url}`);
process.exit(0);
