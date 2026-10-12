// Podcast RSS feeds: a free, quota-less source of episode titles and show notes (guest names, bios, sponsor reads).
// Used for shows that are thin or inactive on YouTube. No dependencies: a small tolerant parser.
import { createHash } from 'node:crypto';
import { cleanDescription } from './text.js';

const MAX_BYTES = 25 * 1024 * 1024; // big shows have feeds with hundreds of episodes

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ' };
function decode(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENT[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function tag(block, name) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  if (!m) return '';
  const inner = m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  return inner;
}

export function htmlToText(html) {
  return decode(
    String(html || '')
      .replace(/<(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n'),
  ).trim();
}

function durationSeconds(s) {
  const t = String(s || '').trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Returns { title, items: [{ video_id, title, url, published_at, description_raw, description_clean, duration_s }] }
export function parseFeed(xml) {
  const text = String(xml || '');
  const channelHead = text.split(/<item[\s>]/i)[0] || '';
  const title = htmlToText(tag(channelHead, 'title')).slice(0, 120);
  const items = [];
  for (const m of text.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const itemTitle = htmlToText(tag(block, 'title')).slice(0, 300);
    const pub = new Date(tag(block, 'pubDate').trim());
    if (!itemTitle || Number.isNaN(pub.getTime())) continue;
    const guid = tag(block, 'guid').trim() || tag(block, 'link').trim() || itemTitle;
    const link = htmlToText(tag(block, 'link')).trim();
    const notesHtml = tag(block, 'content:encoded') || tag(block, 'description') || tag(block, 'itunes:summary');
    const notes = htmlToText(notesHtml);
    items.push({
      video_id: `rss:${createHash('sha1').update(guid).digest('hex').slice(0, 20)}`,
      title: itemTitle,
      url: /^https?:\/\//i.test(link) ? link : '',
      published_at: pub.toISOString(),
      description_raw: notes.slice(0, 5000),
      description_clean: cleanDescription(notes),
      duration_s: durationSeconds(tag(block, 'itunes:duration')),
    });
  }
  return { title, items };
}

// Only public http(s) hosts. Stops the server being used to reach internal addresses.
export function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw new Error('That is not a valid link');
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Feed links must start with http or https');
  const h = u.hostname.toLowerCase();
  const privateV4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h);
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || privateV4 || h.includes(':') || !h.includes('.')) {
    throw new Error('That address is not allowed');
  }
  return u.toString();
}

export async function fetchFeed(url, fetchImpl = fetch) {
  const safe = assertPublicUrl(url);
  const res = await fetchImpl(safe, { headers: { 'user-agent': 'PodcastRadar/1.0 (+rss)', accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);
  const xml = await res.text();
  if (xml.length > MAX_BYTES) throw new Error('Feed is too large');
  const feed = parseFeed(xml);
  if (!feed.items.length) throw new Error('No episodes found in that feed');
  return feed;
}
