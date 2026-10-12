// Pure scoring functions. No network, no database, no clock except the `now` argument.
// Weights and thresholds come from config/scoring.json. All times are UTC.
import cfg from '../config/scoring.json' with { type: 'json' };
import { normKey } from './text.js';

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
  if (!views || views <= 0 || likes === null || comments === null) return null; // either one hidden = missing, not zero
  return (likes + comments) / views;
}

// Per-channel typical performance over the last 90 days, from MATURE videos only.
export function channelBaselines(videos, now) {
  const by = {};
  for (const v of videos) {
    if (v.is_short) continue;
    if (ageDays(v, now) > cfg.maxLookbackDays) continue;
    (by[v.channel_key] ||= []).push(v);
  }
  const out = {};
  const allEng = [];
  for (const [key, list] of Object.entries(by)) {
    let pool = list.filter((v) => isMature(v, now) && ageDays(v, now) <= cfg.windows.baselineDays);
    if (pool.length < cfg.baselineMinVideos) {
      pool = [...list].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, cfg.baselineFallbackRecent);
    }
    const eng = pool.map(engagementRate).filter((x) => x !== null);
    allEng.push(...eng);
    out[key] = { medianViews: median(pool.map((v) => num(v.views))), medianEngagement: median(eng), n: pool.length };
  }
  return { byChannel: out, overallEngagement: median(allEng) };
}

// Topics, guests and sponsors only come from guest-interview episodes (a video with at least one real guest).
// Channel baselines still use every long video, so "typical views" stays fair.
// Shows that post rarely would otherwise be left blank, so for each channel we go further back in time
// (up to maxLookbackDays) until it has at least minEpisodesPerChannel guest episodes. Busy shows use the normal window.
function inWindow(videos, days, now) {
  const byChannel = new Map();
  for (const v of videos) {
    const age = ageDays(v, now);
    if (v.is_short || age < 0 || age > cfg.maxLookbackDays) continue;
    if (cfg.requireGuest && !(v.guests || []).length) continue;
    if (!byChannel.has(v.channel_key)) byChannel.set(v.channel_key, []);
    byChannel.get(v.channel_key).push(v);
  }
  const out = [];
  for (const list of byChannel.values()) {
    list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    list.forEach((v, i) => {
      if (i >= cfg.maxEpisodesPerChannel) return; // no single show can dominate the rankings
      if (ageDays(v, now) <= days || i < cfg.minEpisodesPerChannel) out.push(v);
    });
  }
  return out;
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
  // Shows covering each topic in each of the last 12 weeks. Counting distinct shows (not episodes) keeps one chatty show from
  // faking a spike, and it matches how topics are ranked.
  const showWeeks = new Map();
  for (const v of videos) {
    const age = ageDays(v, now);
    if (v.is_short || age < 0 || age >= 84 || (cfg.requireGuest && !(v.guests || []).length)) continue;
    const bin = Math.floor(age / 7);
    for (const topic of v.topics || []) {
      if (!showWeeks.has(topic)) showWeeks.set(topic, Array.from({ length: 12 }, () => new Set()));
      showWeeks.get(topic)[bin].add(v.channel_key);
    }
  }
  const recentAll = win.filter((v) => ageDays(v, now) <= t.simultaneousDays).length || 1;

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
    const perfAvailable = ratios.length > 0; // RSS-only shows have no view counts
    const performance = perfAvailable ? clamp(median(ratios) / t.performanceCap, 0, 1) : 0;
    const engMed = median(mature.map(engagementRate).filter((x) => x !== null));
    const engAvailable = Boolean(overallEng) && engMed !== null;
    const engagement = engAvailable ? clamp(engMed / (t.engagementCap * overallEng), 0, 1) : 0;
    const channels = new Set(list.map((v) => v.channel_key)).size;
    const coverage = clamp(channels / Math.min(t.coverageChannels, totalChannels), 0, 1);
    const recentShare = list.filter((v) => ageDays(v, now) <= t.recencyDays).length / list.length;
    const recency = clamp(recentShare / t.recencyFull, 0, 1);
    const w = t.weights;
    const wSum = (perfAvailable ? w.performance : 0) + (engAvailable ? w.engagement : 0) + w.coverage + w.recency; // missing engagement is dropped, not scored as zero
    const score = (10 * ((perfAvailable ? w.performance * performance : 0) + (engAvailable ? w.engagement * engagement : 0) + w.coverage * coverage + w.recency * recency)) / wSum;
    const probability = clamp((hits + 1) / (n + 2), cfg.probabilityClamp.min, cfg.probabilityClamp.max);
    // Trend: this topic's guest episodes in the last 14 days against the 14 days before.
    const between = (a, b) => list.filter((v) => ageDays(v, now) >= a && ageDays(v, now) < b).length;
    const recentN = between(0, 14);
    const previousN = between(14, 28);
    let trendLabel = 'steady';
    if (previousN === 0) trendLabel = recentN >= 2 ? 'new' : 'steady';
    else if (recentN >= 2 && recentN >= previousN * 1.25) trendLabel = 'rising';
    else if (previousN >= 2 && recentN <= previousN * 0.75) trendLabel = 'cooling';
    // Simultaneous coverage: how many different shows covered it inside the same recent window, and how much of all recent talk it is.
    const recentList = list.filter((v) => ageDays(v, now) <= t.simultaneousDays);
    const simShows = new Set(recentList.map((v) => v.channel_key)).size;
    const share = recentList.length / recentAll;
    // ride = several shows are on it now; counter-programme = it is so crowded that doing it the same way will not stand out
    const stance = simShows >= t.rideMinShows ? (share >= t.crowdedShare ? 'counter' : 'ride') : 'emerging';
    const weekly = [3, 2, 1, 0].map((i) => between(i * 7, (i + 1) * 7));
    // shows covering this topic per week for the last 12 weeks (oldest first), for the Trends block
    const weeklyShows = (showWeeks.get(name) || Array.from({ length: 12 }, () => new Set())).map((s) => s.size).reverse();
    const why =
      `${list.length} video${list.length === 1 ? '' : 's'} across ${channels} show${channels === 1 ? '' : 's'} in ${cfg.windows.topicsGuestsDays} days; ${simShows} show${simShows === 1 ? '' : 's'} covered it in the last ${t.simultaneousDays} days (${recentN} episodes in the last 2 weeks vs ${previousN} before); ` +
      (n ? `${hits} of ${n} mature video${n === 1 ? '' : 's'} beat their channel's typical views` : 'too new to judge views yet');
    return {
      topic: name,
      score: Math.round(score * 10) / 10,
      probability: pct(probability),
      why,
      videos: list.length,
      channels,
      simultaneous: { shows: simShows, days: t.simultaneousDays, share: Math.round(share * 100) },
      stance,
      weekly,
      weeklyShows,
      evidence: evidence(list, (v) => ratio(v) ?? -1),
      trend: { label: trendLabel, recent: recentN, previous: previousN },
      parts: { performance, engagement, coverage, recency, hits, n },
    };
  };

  // Need enough videos per topic to mean something. Relax step by step (5 -> 3 -> 2 -> 1) only if fewer than 6 topics qualify.
  let rows = [];
  for (const min of [...new Set([t.minVideos, 3, 2, 1])].filter((m) => m <= t.minVideos)) {
    rows = [...groups].filter(([, l]) => l.length >= min).map(([n, l]) => build(n, l));
    if (rows.length >= cfg.counts.topics) break;
  }
  // Ranked by how many different shows are covering it at the same time, then by score, then by probability.
  rows.sort((a, b) => b.simultaneous.shows - a.simultaneous.shows || b.score - a.score || b.probability - a.probability || a.topic.localeCompare(b.topic));
  return rows.slice(0, cfg.counts.topics).map((r, i) => ({ ...r, rank: i + 1 }));
}

const ROLE_LABEL = { founder: 'Founder', investor: 'Investor', executive: 'Executive', analyst: 'Analyst', creator: 'Creator', celebrity: 'Public figure', other: 'Guest', unknown: 'Guest' };

// Guests are ranked on their own: no topic is involved. Only founders are listed (Aditya hosts founders); a guest whose role could
// not be read from the text gets the benefit of the doubt. Media round = on two or more shows within the same month (30 days).
// The formula keeps its media-willingness and recency weights; the old topic-fit share is gone, so the two weights are scaled to 100%.
export function guestRanking(videos, now, exclude = new Set()) {
  const g = cfg.guest;
  const win = videos.filter((v) => !v.is_short && ageDays(v, now) >= 0 && ageDays(v, now) <= cfg.windows.topicsGuestsDays && (!cfg.requireGuest || (v.guests || []).length > 0));
  const history = videos.filter((v) => !v.is_short && ageDays(v, now) >= 0 && ageDays(v, now) <= cfg.maxLookbackDays && (v.guests || []).length > 0);
  const groups = new Map();
  for (const v of win) for (const guest of v.guests || []) (groups.get(guest) || groups.set(guest, []).get(guest)).push(v);
  const infoOf = (v, name) => (v.guest_info || []).find((x) => x.name === name);
  const rows = [];
  let skippedNotFounders = 0;
  for (const [name, list] of groups) {
    if (exclude.has(normKey(name))) continue; // confirmed by Aditya
    const roles = list.map((v) => infoOf(v, name)?.role).filter((r) => r && r !== 'unknown');
    const tally = {};
    for (const r of roles) tally[r] = (tally[r] || 0) + 1;
    const role = roles.length ? Object.entries(tally).sort((x, y) => y[1] - x[1])[0][0] : 'unknown';
    if (g.requireFounder && role !== 'founder' && role !== 'unknown') {
      skippedNotFounders++;
      continue;
    }
    const company = list.map((v) => infoOf(v, name)?.company).find(Boolean) || '';
    const monthShows = [...new Set(list.filter((v) => ageDays(v, now) <= g.mediaRoundDays).map((v) => v.channel_title))];
    const channels = [...new Set(list.map((v) => v.channel_title))];
    let mediaWilling = Math.min(monthShows.length, g.channelCap) / g.channelCap;
    if (monthShows.length >= g.floodedAt) mediaWilling *= g.floodedFactor;
    const last = Math.max(...list.map((v) => new Date(v.published_at).getTime()));
    const daysSince = Math.max(0, (now.getTime() - last) / DAY);
    const recency = Math.exp(-daysSince / g.recencyHalfDays);
    const w = g.weights;
    const probability = clamp((w.mediaWilling * mediaWilling + w.recency * recency) / (w.mediaWilling + w.recency), cfg.probabilityClamp.min, cfg.probabilityClamp.max);
    // Exposure over the whole lookback: few appearances = a fresh voice not yet inundated; many shows = already heavily booked.
    const past = history.filter((v) => (v.guests || []).includes(name));
    const pastShows = new Set(past.map((v) => v.channel_title)).size;
    const fresh = past.length <= g.freshMaxAppearances;
    const saturated = pastShows >= g.floodedAt;
    const who = company ? `${ROLE_LABEL[role]} at ${company}` : ROLE_LABEL[role];
    rows.push({
      guest: name,
      role,
      company,
      probability: pct(probability),
      shows: channels,
      monthShows,
      mediaRound: monthShows.length >= 2,
      fresh,
      saturated,
      lastSeen: new Date(last).toISOString(),
      why:
        `${who}. ${list.length} appearance${list.length === 1 ? '' : 's'} on ${channels.length} show${channels.length === 1 ? '' : 's'}, last ${Math.round(daysSince)} day${Math.round(daysSince) === 1 ? '' : 's'} ago; ` +
        (monthShows.length >= 2 ? `on ${monthShows.length} shows in the last ${g.mediaRoundDays} days (a media round)` : `${monthShows.length} show${monthShows.length === 1 ? '' : 's'} in the last ${g.mediaRoundDays} days`),
      evidence: evidence(list, (v) => new Date(v.published_at).getTime()),
      _channels: monthShows.length,
      _last: last,
    });
  }
  const order = (a, b) => b.probability - a.probability || b._last - a._last || b._channels - a._channels || a.guest.localeCompare(b.guest);
  rows.sort(order);
  return {
    rows: rows.slice(0, cfg.counts.guests + (cfg.counts.moreGuests || 0)).map(({ _channels, _last, ...r }, i) => ({ ...r, rank: i + 1 })),
    mediaRounds: rows.filter((r) => r.mediaRound).length,
    skippedNotFounders,
    eligible: rows.length,
  };
}

export function scoreGuests(videos, now, exclude = new Set()) {
  return guestRanking(videos, now, exclude).rows.slice(0, cfg.counts.guests);
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
      qualifies: channels.length >= s.minShows || paidSignal > 0,
      repeated: mentions >= s.minMentions,
      _last: last,
    });
  }
  const order = (a, b) => b.probability - a.probability || b._last - a._last || a.brand.localeCompare(b.brand);
  // A brand qualifies when it appears on two or more shows or shows paid promotion. If that gives fewer than 5, brands named twice fill the rest; one-off mentions never do.
  let pool = rows.filter((r) => r.qualifies).sort(order);
  if (pool.length < cfg.counts.sponsors) pool = [...pool, ...rows.filter((r) => !r.qualifies && r.repeated).sort(order)];
  return pool.slice(0, cfg.counts.sponsors).map(({ qualifies, repeated, _last, ...r }, i) => ({ ...r, rank: i + 1 }));
}

// Everything the dashboard and the email need, computed once and stored as the snapshot.
export function buildResults(videos, now = new Date(), opts = {}) {
  const exclude = opts.excludeGuests || new Set();
  const baselines = channelBaselines(videos, now);
  const topics = scoreTopics(videos, now, baselines);
  const gr = guestRanking(videos, now, exclude);
  const guests = gr.rows.slice(0, cfg.counts.guests); // top picks
  const moreGuests = gr.rows.slice(cfg.counts.guests); // next tier: real founders, but a weaker booking signal
  const sponsors = scoreSponsors(videos, now);
  const win = inWindow(videos, cfg.windows.topicsGuestsDays, now);
  return {
    computed_at: now.toISOString(),
    excluded: exclude.size,
    topics,
    guests,
    moreGuests,
    mediaRounds: gr.mediaRounds,
    skippedNotFounders: gr.skippedNotFounders,
    sponsors,
    counts: { videos: win.length, channels: new Set(win.map((v) => v.channel_key)).size },
    notes: {
      fewerTopics: topics.length < cfg.counts.topics,
      fewerGuests: guests.length < cfg.counts.guests,
      fewerSponsors: sponsors.length < cfg.counts.sponsors,
    },
  };
}
