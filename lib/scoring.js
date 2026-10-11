// Pure scoring functions. No network, no database, no clock except the `now` argument.
// Weights and thresholds come from config/scoring.json. All times are UTC.
import cfg from '../config/scoring.json' with { type: 'json' };

const DAY = 86400000;

export const clamp = (x, lo, hi) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);
export const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function median(arr) {
  const a = arr.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const ageDays = (v, now) => (now.getTime() - new Date(v.published_at).getTime()) / DAY;
const isMature = (v, now) => ageDays(v, now) >= cfg.matureAfterDays;

// likes/comments can be hidden (null). Returns null when it cannot be computed. Never divides by null or zero.
export function engagementRate(v) {
  const views = num(v.views);
  const likes = num(v.likes);
  const comments = num(v.comments);
  if (!views || views <= 0 || (likes === null && comments === null)) return null;
  return ((likes || 0) + (comments || 0)) / views;
}

// Per-channel typical performance over the last 90 days, from MATURE videos only.
export function channelBaselines(videos, now) {
  const by = {};
  for (const v of videos) {
    if (v.is_short) continue;
    if (ageDays(v, now) > cfg.windows.baselineDays) continue;
    (by[v.channel_key] ||= []).push(v);
  }
  const out = {};
  const allEng = [];
  for (const [key, list] of Object.entries(by)) {
    let pool = list.filter((v) => isMature(v, now));
    if (pool.length < cfg.baselineMinVideos) {
      pool = [...list].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, cfg.baselineFallbackRecent);
    }
    const eng = pool.map(engagementRate).filter((x) => x !== null);
    allEng.push(...eng);
    out[key] = { medianViews: median(pool.map((v) => num(v.views))), medianEngagement: median(eng), n: pool.length };
  }
  return { byChannel: out, overallEngagement: median(allEng) };
}

function inWindow(videos, days, now) {
  return videos.filter((v) => !v.is_short && ageDays(v, now) <= days && ageDays(v, now) >= 0);
}

const pct = (p) => Math.round(p * 1000) / 10; // 0.4567 -> 45.7

function evidence(list, scoreFn) {
  return [...list]
    .sort((a, b) => scoreFn(b) - scoreFn(a))
    .slice(0, 3)
    .map((v) => ({ video_id: v.video_id, title: v.title, url: v.url, channel: v.channel_title, published_at: v.published_at, views: num(v.views) }));
}

export function scoreTopics(videos, now, baselines = channelBaselines(videos, now)) {
  const t = cfg.topic;
  const win = inWindow(videos, cfg.windows.topicsGuestsDays, now);
  const totalChannels = new Set(win.map((v) => v.channel_key)).size || 1;
  const groups = new Map();
  for (const v of win) for (const topic of v.topics || []) (groups.get(topic) || groups.set(topic, []).get(topic)).push(v);
  const overallEng = baselines.overallEngagement;

  const build = (name, list) => {
    const mature = list.filter((v) => isMature(v, now));
    const ratio = (v) => {
      const base = baselines.byChannel[v.channel_key]?.medianViews;
      const views = num(v.views);
      return base && base > 0 && views !== null ? views / base : null;
    };
    const ratios = mature.map(ratio).filter((x) => x !== null);
    const hits = ratios.filter((r) => r > 1).length;
    const n = ratios.length;
    const performance = clamp((median(ratios) ?? 0) / t.performanceCap, 0, 1);
    const engMed = median(mature.map(engagementRate).filter((x) => x !== null));
    const engagement = overallEng ? clamp((engMed ?? 0) / (t.engagementCap * overallEng), 0, 1) : 0;
    const channels = new Set(list.map((v) => v.channel_key)).size;
    const coverage = clamp(channels / Math.min(t.coverageChannels, totalChannels), 0, 1);
    const recentShare = list.filter((v) => ageDays(v, now) <= t.recencyDays).length / list.length;
    const recency = clamp(recentShare / t.recencyFull, 0, 1);
    const w = t.weights;
    const score = 10 * (w.performance * performance + w.engagement * engagement + w.coverage * coverage + w.recency * recency);
    const probability = clamp((hits + 1) / (n + 2), cfg.probabilityClamp.min, cfg.probabilityClamp.max);
    const why =
      `${list.length} video${list.length === 1 ? '' : 's'} across ${channels} show${channels === 1 ? '' : 's'} in 30 days; ` +
      (n ? `${hits} of ${n} mature video${n === 1 ? '' : 's'} beat their channel's typical views` : 'too new to judge views yet');
    return {
      topic: name,
      score: Math.round(score * 10) / 10,
      probability: pct(probability),
      why,
      videos: list.length,
      channels,
      evidence: evidence(list, (v) => ratio(v) ?? -1),
      parts: { performance, engagement, coverage, recency, hits, n },
    };
  };

  let rows = [...groups].filter(([, l]) => l.length >= t.minVideos).map(([n, l]) => build(n, l));
  if (rows.length < cfg.counts.topics) {
    rows = [...groups].filter(([, l]) => l.length >= 1).map(([n, l]) => build(n, l)); // relax to 1 video
  }
  rows.sort((a, b) => b.probability - a.probability || b.score - a.score || a.topic.localeCompare(b.topic));
  return rows.slice(0, cfg.counts.topics).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function scoreGuests(videos, now, topicName) {
  const g = cfg.guest;
  const win = inWindow(videos, cfg.windows.topicsGuestsDays, now);
  const groups = new Map();
  for (const v of win) for (const guest of v.guests || []) (groups.get(guest) || groups.set(guest, []).get(guest)).push(v);
  const rows = [];
  for (const [name, list] of groups) {
    const channels = [...new Set(list.map((v) => v.channel_title))];
    let mediaWilling = Math.min(channels.length, g.channelCap) / g.channelCap;
    if (channels.length >= g.floodedAt) mediaWilling *= g.floodedFactor;
    const last = Math.max(...list.map((v) => new Date(v.published_at).getTime()));
    const daysSince = Math.max(0, (now.getTime() - last) / DAY);
    const recency = Math.exp(-daysSince / g.recencyHalfDays);
    const fitCount = list.filter((v) => (v.topics || []).includes(topicName)).length;
    const topicFit = fitCount / list.length;
    const w = g.weights;
    const probability = clamp(w.mediaWilling * mediaWilling + w.recency * recency + w.topicFit * topicFit, cfg.probabilityClamp.min, cfg.probabilityClamp.max);
    rows.push({
      guest: name,
      probability: pct(probability),
      shows: channels,
      mediaRound: channels.length >= 2,
      lastSeen: new Date(last).toISOString(),
      adjacent: fitCount === 0,
      why:
        `${list.length} appearance${list.length === 1 ? '' : 's'} on ${channels.length} show${channels.length === 1 ? '' : 's'}, last ${Math.round(daysSince)} day${Math.round(daysSince) === 1 ? '' : 's'} ago` +
        (fitCount ? `; ${fitCount} on this topic` : '; adjacent topic'),
      evidence: evidence(list, (v) => (v.topics || []).includes(topicName) ? 1e12 + new Date(v.published_at).getTime() : new Date(v.published_at).getTime()),
      _channels: channels.length,
      _last: last,
    });
  }
  const order = (a, b) => b.probability - a.probability || b._last - a._last || b._channels - a._channels || a.guest.localeCompare(b.guest);
  const tier1 = rows.filter((r) => !r.adjacent).sort(order);
  const tier2 = rows.filter((r) => r.adjacent).sort(order);
  return [...tier1, ...tier2].slice(0, cfg.counts.guests).map(({ _channels, _last, ...r }, i) => ({ ...r, rank: i + 1 }));
}

export function scoreSponsors(videos, now) {
  const s = cfg.sponsor;
  const win = inWindow(videos, cfg.windows.sponsorsDays, now);
  const groups = new Map();
  for (const v of win) {
    const seen = new Set();
    for (const b of v.brands || []) {
      if (seen.has(b.name)) continue;
      seen.add(b.name);
      (groups.get(b.name) || groups.set(b.name, []).get(b.name)).push({ v, sponsored: Boolean(b.sponsored) });
    }
  }
  const rows = [];
  for (const [name, items] of groups) {
    const channels = [...new Set(items.map((i) => i.v.channel_title))];
    const mentions = items.length;
    const reach = Math.min(channels.length, s.channelCap) / s.channelCap;
    const last = Math.max(...items.map((i) => new Date(i.v.published_at).getTime()));
    const daysSince = Math.max(0, (now.getTime() - last) / DAY);
    const recency = Math.exp(-daysSince / s.recencyHalfDays);
    const paidSignal = items.filter((i) => i.sponsored).length / mentions;
    const frequency = Math.min(mentions, s.frequencyCap) / s.frequencyCap;
    const w = s.weights;
    const probability = clamp(w.reach * reach + w.recency * recency + w.paidSignal * paidSignal + w.frequency * frequency, cfg.probabilityClamp.min, cfg.probabilityClamp.max);
    rows.push({
      brand: name,
      probability: pct(probability),
      shows: channels,
      mentions,
      likelyAdvertiser: paidSignal > 0,
      why: `${mentions} mention${mentions === 1 ? '' : 's'} on ${channels.length} show${channels.length === 1 ? '' : 's'}; ${Math.round(paidSignal * 100)}% flagged as paid promotion`,
      evidence: evidence(items.map((i) => i.v), (v) => new Date(v.published_at).getTime()),
      qualifies: mentions >= s.minMentions || paidSignal > 0,
      _last: last,
    });
  }
  const order = (a, b) => b.probability - a.probability || b._last - a._last || a.brand.localeCompare(b.brand);
  let pool = rows.filter((r) => r.qualifies);
  if (pool.length < cfg.counts.sponsors) pool = rows; // relax: not enough qualify
  return pool.sort(order).slice(0, cfg.counts.sponsors).map(({ qualifies, _last, ...r }, i) => ({ ...r, rank: i + 1 }));
}

// Everything the dashboard and the email need, computed once and stored as the snapshot.
export function buildResults(videos, now = new Date()) {
  const baselines = channelBaselines(videos, now);
  const topics = scoreTopics(videos, now, baselines);
  const guestsByTopic = {};
  for (const t of topics) guestsByTopic[t.topic] = scoreGuests(videos, now, t.topic);
  const sponsors = scoreSponsors(videos, now);
  const win = inWindow(videos, cfg.windows.topicsGuestsDays, now);
  return {
    computed_at: now.toISOString(),
    topics,
    guestsByTopic,
    sponsors,
    counts: { videos: win.length, channels: new Set(win.map((v) => v.channel_key)).size },
    notes: {
      fewerTopics: topics.length < cfg.counts.topics,
      fewerGuests: topics.length ? Object.values(guestsByTopic).some((g) => g.length < cfg.counts.guests) : false,
      fewerSponsors: sponsors.length < cfg.counts.sponsors,
    },
  };
}
