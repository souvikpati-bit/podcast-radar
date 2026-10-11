// Automatic RSS reinforcement: find podcast feeds without any manual input.
// Uses Apple's free podcast directory (no API key, no quota) and then reads the feed itself to prove the show is real and active.
import disc from '../config/discovery.json' with { type: 'json' };
import { normKey } from './text.js';
import { fetchFeed } from './rss.js';

const tokens = (s) => new Set(normKey(s).split(' ').filter((w) => w.length > 1));

// 1 = same words. Used to match a YouTube channel name to a podcast name.
export function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

// Share of the smaller title's words found in the other. Used to spot the same episode on YouTube and in a feed.
export function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (Math.min(A.size, B.size) < 3) return normKey(a) === normKey(b) ? 1 : 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

export async function searchPodcasts(term, fetchImpl = fetch) {
  const url = `https://itunes.apple.com/search?media=podcast&country=IN&limit=${disc.resultsPerQuery}&term=${encodeURIComponent(term)}`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.results || []).filter((r) => r.feedUrl).map((r) => ({ name: r.collectionName || '', artist: r.artistName || '', feedUrl: r.feedUrl }));
  } catch {
    return [];
  }
}

const median = (a) => {
  const s = a.filter((n) => n > 0).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

// Reads the feed and decides if the show is active, long-form and not a daily news bulletin.
export async function assessFeed(feedUrl, fetchImpl = fetch, now = Date.now()) {
  const feed = await fetchFeed(feedUrl, fetchImpl);
  const cutoff = now - disc.lookbackDays * 86400000;
  const recent = feed.items.filter((i) => new Date(i.published_at).getTime() >= cutoff);
  const medMin = median(recent.map((i) => i.duration_s)) / 60;
  const ok = recent.length >= disc.minRecentEpisodes && recent.length <= disc.maxEpisodesIn180Days && (medMin === 0 || medMin >= disc.minMedianMinutes);
  return { ok, title: feed.title, recent: recent.length, medianMinutes: Math.round(medMin) };
}

// Find the podcast feed of a show we already monitor (matched by name). Returns { feedUrl, name, artist } or null.
export async function findFeedForShow(title, fetchImpl = fetch) {
  const results = await searchPodcasts(title, fetchImpl);
  let best = null;
  let bestScore = 0;
  for (const r of results) {
    const s = similarity(title, r.name);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best || bestScore < disc.minNameMatch) return null;
  try {
    const a = await assessFeed(best.feedUrl, fetchImpl);
    return a.recent >= 3 ? { feedUrl: best.feedUrl, name: best.name, artist: best.artist } : null;
  } catch {
    return null;
  }
}

// Look for new India business/startup shows. Only active, long-form, guest-style feeds are returned.
export async function discoverNewShows({ existingNames = new Set(), existingFeeds = new Set(), rejects = new Set(), max = disc.maxNewShowsPerRun, fetchImpl = fetch } = {}) {
  const seen = new Set();
  const candidates = [];
  for (const q of disc.queries) {
    for (const r of await searchPodcasts(q, fetchImpl)) {
      const key = normKey(r.name);
      if (!key || seen.has(r.feedUrl) || existingFeeds.has(r.feedUrl) || existingNames.has(key) || rejects.has(r.feedUrl) || rejects.has(key)) continue;
      seen.add(r.feedUrl);
      candidates.push(r);
    }
  }
  const out = [];
  for (const c of candidates.slice(0, disc.maxValidationsPerRun)) {
    try {
      const a = await assessFeed(c.feedUrl, fetchImpl);
      if (a.ok) out.push({ ...c, name: a.title || c.name, recent: a.recent });
    } catch {
      /* not a usable feed: skip */
    }
  }
  return out.sort((x, y) => y.recent - x.recent).slice(0, max);
}
