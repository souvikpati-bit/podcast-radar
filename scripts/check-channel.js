// Real-API check (M1): node --env-file=.env.local scripts/check-channel.js @LennysPodcast
import { resolveChannel, fetchChannelVideos, newUnitCounter } from '../lib/youtube.js';

const handle = process.argv[2] || '@LennysPodcast';
const counter = newUnitCounter();
const ch = await resolveChannel(handle, counter);
const vids = await fetchChannelVideos(ch.uploads_playlist_id, counter);
console.log(`${ch.title}: ${vids.length} videos, ${counter.units} quota units`);
console.log(vids.slice(0, 5).map((v) => `${v.published_at.slice(0, 10)} views=${v.views} likes=${v.likes} ${v.title.slice(0, 60)}`).join('\n'));
