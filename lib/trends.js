// Public interest in each topic over time, from Wikipedia daily page views (free, no key). It is a proxy for "hype": how many
// people read about the subject. Failures never break a refresh: the Trends block simply shows episode counts without the interest line.
import cfg from '../config/trend-articles.json' with { type: 'json' };

const DAY = 86400000;
const UA = 'PodcastEcosystemRadar/1.0 (student exam project; contact via GitHub souvikpati-bit/podcast-radar)';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}00`;

async function getJson(url, fetchImpl, gap = cfg.requestGapMs) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await pause(gap);
    const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(cfg.timeoutMs) });
    if (res.status === 429) {
      await pause(2000);
      continue;
    }
    if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
    return res.json();
  }
  throw new Error('Wikipedia is rate limiting this server right now');
}

// Week labels, oldest first: the day each 7-day bin starts.
export function weekLabels(now = new Date(), weeks = cfg.weeks) {
  return Array.from({ length: weeks }, (_, k) => {
    const d = new Date(now.getTime() - (weeks - k) * 7 * DAY);
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(d);
  });
}

// Average daily views per 7-day bin (bin 0 = the latest week), added up over the given articles. Returns oldest first.
// Each bin is averaged over the days Wikipedia actually published, so the newest, shorter week is not read as a drop.
export async function fetchInterest(articles, now = new Date(), fetchImpl = fetch, weeks = cfg.weeks) {
  const end = new Date(now.getTime() - DAY);
  const start = new Date(now.getTime() - weeks * 7 * DAY);
  const total = Array(weeks).fill(0);
  for (const title of articles) {
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${ymd(start)}/${ymd(end)}`;
    const data = await getJson(url, fetchImpl);
    const sum = Array(weeks).fill(0);
    const n = Array(weeks).fill(0);
    for (const it of data.items || []) {
      const ts = String(it.timestamp);
      const day = Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8));
      const bin = Math.floor((now.getTime() - day) / (7 * DAY));
      if (bin >= 0 && bin < weeks) {
        sum[bin] += Number(it.views) || 0;
        n[bin] += 1;
      }
    }
    for (let i = 0; i < weeks; i++) total[i] += n[i] ? sum[i] / n[i] : 0;
  }
  return total.map((v) => Math.round(v)).reverse();
}

// Topics that are not in the list are matched to the best Wikipedia article by name.
export async function findArticle(topic, fetchImpl = fetch) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json`;
  const data = await getJson(url, fetchImpl);
  return data?.query?.search?.[0]?.title || null;
}

// Adds results.trends = { weeks, source, interest: {topic: [..]}, articles: {topic: [..]}, fetchedAt, error? }.
// `previous` is an earlier trends block: topics it already has are reused, so a quick re-score makes no new requests.
export async function attachTrends(results, now = new Date(), { fetchImpl = fetch, previous = null } = {}) {
  const trends = { weeks: weekLabels(now), source: 'Wikipedia page views', interest: {}, articles: {}, fetchedAt: now.toISOString() };
  const errors = [];
  for (const t of results.topics) {
    const reuse = previous?.interest?.[t.topic];
    if (reuse && previous?.articles?.[t.topic]) {
      trends.interest[t.topic] = reuse;
      trends.articles[t.topic] = previous.articles[t.topic];
      continue;
    }
    try {
      let arts = cfg.articles[t.topic];
      if (!arts) {
        const found = await findArticle(t.topic, fetchImpl);
        arts = found ? [found] : [];
      }
      if (!arts.length) continue;
      trends.interest[t.topic] = await fetchInterest(arts, now, fetchImpl);
      trends.articles[t.topic] = arts;
    } catch (err) {
      errors.push(`${t.topic}: ${String(err.message).slice(0, 80)}`);
    }
  }
  if (errors.length) trends.error = errors.slice(0, 3).join('; ');
  return { ...results, trends };
}
