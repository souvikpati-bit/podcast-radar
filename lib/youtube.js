// YouTube Data API v3 client. Never calls search.list. Counts quota units.
// The key is sent in the x-goog-api-key header so it never appears in a URL or a log line.
import cfg from '../config/pipeline.json' with { type: 'json' };
import { getEnv } from './env.js';
import { cleanDescription, extractLinks, parseDurationSeconds } from './text.js';

const BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function newUnitCounter() {
  return { units: 0 };
}

async function yt(endpoint, params, counter, fetchImpl = fetch) {
  const key = getEnv().youtubeKey;
  if (!key) throw new YouTubeError('YOUTUBE_API_KEY is not set', 'no_key');
  const url = `${BASE}/${endpoint}?${new URLSearchParams(params)}`;
  const res = await fetchImpl(url, { headers: { 'x-goog-api-key': key } });
  counter.units += 1; // channels/playlistItems/videos.list all cost 1 unit per call
  if (!res.ok) {
    let reason = '';
    try {
      const body = await res.json();
      reason = body?.error?.errors?.[0]?.reason || body?.error?.message || '';
    } catch {
      /* ignore */
    }
    const code = reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' ? 'quota' : `http_${res.status}`;
    throw new YouTubeError(`YouTube ${endpoint} failed (${res.status}${reason ? ': ' + String(reason).slice(0, 80) : ''})`, code);
  }
  return res.json();
}

// Accepts @handle, a channel URL (youtube.com/@x or /channel/UC...) or a bare channel ID.
export function parseChannelInput(input) {
  const raw = String(input || '').trim().slice(0, 200);
  if (!raw) return null;
  const idMatch = /(?:^|\/channel\/)(UC[\w-]{22})(?:[/?#]|$)/.exec(raw);
  if (idMatch) return { type: 'id', value: idMatch[1] };
  const urlHandle = /youtube\.com\/(@[\w.\-]{2,60})/i.exec(raw);
  if (urlHandle) return { type: 'handle', value: urlHandle[1] };
  if (/^@?[\w.\-]{2,60}$/.test(raw)) return { type: 'handle', value: raw.startsWith('@') ? raw : `@${raw}` };
  return null;
}

export async function resolveChannel(input, counter = newUnitCounter(), fetchImpl = fetch) {
  const parsed = parseChannelInput(input);
  if (!parsed) throw new YouTubeError('That does not look like a handle, channel URL or channel ID', 'bad_input');
  const params = { part: 'snippet,contentDetails', ...(parsed.type === 'id' ? { id: parsed.value } : { forHandle: parsed.value }) };
  const data = await yt('channels', params, counter, fetchImpl);
  const item = data.items?.[0];
  if (!item) throw new YouTubeError('No YouTube channel found for that input', 'not_found');
  return {
    handle: parsed.type === 'handle' ? parsed.value : item.snippet?.customUrl || item.id,
    youtube_channel_id: item.id,
    uploads_playlist_id: item.contentDetails?.relatedPlaylists?.uploads || null,
    title: item.snippet?.title || '',
    thumbnail: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url || null,
  };
}

function toNum(v) {
  if (v === undefined || v === null || v === '') return null; // hidden counts are null, never 0
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapVideo(item, now = new Date()) {
  const durationS = parseDurationSeconds(item.contentDetails?.duration);
  const raw = item.snippet?.description || '';
  return {
    video_id: item.id,
    title: item.snippet?.title || '',
    description_raw: raw.slice(0, 5000),
    description_clean: cleanDescription(raw),
    links: extractLinks(raw),
    tags: (item.snippet?.tags || []).slice(0, 30),
    published_at: item.snippet?.publishedAt,
    duration_s: durationS,
    is_short: durationS > 0 && durationS <= cfg.shortMaxSeconds,
    live: item.snippet?.liveBroadcastContent || 'none',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    views: toNum(item.statistics?.viewCount),
    likes: toNum(item.statistics?.likeCount),
    comments: toNum(item.statistics?.commentCount),
    captured_at: now.toISOString(),
  };
}

// Newest first from the uploads playlist, stopping once videos are older than the window.
export async function fetchChannelVideos(uploadsPlaylistId, counter, { days = cfg.fetchWindowDays, now = new Date(), fetchImpl = fetch } = {}) {
  const cutoff = now.getTime() - days * 86400000;
  const ids = [];
  let pageToken;
  for (let page = 0; page < cfg.maxPlaylistPages; page++) {
    const data = await yt(
      'playlistItems',
      { part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      counter,
      fetchImpl,
    );
    let reachedOld = false;
    for (const it of data.items || []) {
      const published = new Date(it.contentDetails?.videoPublishedAt || 0).getTime();
      if (published && published < cutoff) {
        reachedOld = true;
        continue;
      }
      if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    }
    pageToken = data.nextPageToken;
    if (reachedOld || !pageToken) break;
  }
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt(
      'videos',
      { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(','), maxResults: '50' },
      counter,
      fetchImpl,
    );
    for (const item of data.items || []) videos.push(mapVideo(item, now));
  }
  // Skip live/upcoming streams not yet finished.
  return videos.filter((v) => v.live === 'none');
}
