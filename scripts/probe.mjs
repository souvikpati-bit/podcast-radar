import { resolveChannel, fetchChannelVideos, newUnitCounter } from '../lib/youtube.js';
import { hasPaidSignal } from '../lib/text.js';
const cands = ['@ZerodhaOnline'];
const c = newUnitCounter();
const guestRe = /\b(with|ft\.?|feat\.?|in conversation|x|\|)\b/i;
const eng = (s) => (s.match(/[A-Za-z]/g) || []).length / Math.max(1, s.replace(/\s/g, '').length);
for (const h of cands) {
  try {
    const ch = await resolveChannel(h, c);
    const v = (await fetchChannelVideos(ch.uploads_playlist_id, c, { days: 45 })).filter((x) => !x.is_short);
    const sponsored = v.filter((x) => hasPaidSignal(x.description_raw)).length;
    const guests = v.filter((x) => guestRe.test(x.title)).length;
    const english = v.length ? Math.round((v.filter((x) => eng(x.title) > 0.85).length / v.length) * 100) : 0;
    const med = v.map((x) => x.views || 0).sort((a, b) => a - b)[Math.floor(v.length / 2)] || 0;
    console.log(`${h} | ${ch.title} | 45d long: ${v.length} | guest-style: ${guests} | sponsor-signal: ${sponsored} | latin-title%: ${english} | median views: ${med}\n    e.g. ${v.slice(0, 3).map((x) => x.title.slice(0, 55)).join(' // ')}`);
  } catch (e) { console.log(`${h} ERR ${e.message.slice(0, 70)}`); }
  console.log(`    (units so far: ${c.units})`);
}
process.exit(0);




