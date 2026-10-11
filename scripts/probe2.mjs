import { resolveChannel, fetchChannelVideos, newUnitCounter } from '../lib/youtube.js';
const cands = ['@AbhiandNiyu','@MohakMangal','@JoshTalksLive','@JoshTalksHindi','@SandeepMaheshwari','@TheRanveerShowHindi','@samdishbhatia','@AshneerGroverOfficial','@ETNowSwadesh','@PrimeVenturePartners','@entrepreneurindia','@ETPrime','@Zerodhaonline'];
const c = newUnitCounter();
const guestRe = /\b(with|ft\.?|feat\.?|in conversation|ep\.?\s?\d+|podcast|interview|founder|ceo)\b|\|/i;
for (const h of cands) {
  try {
    const ch = await resolveChannel(h, c);
    const v = (await fetchChannelVideos(ch.uploads_playlist_id, c, { days: 180 })).filter((x) => !x.is_short);
    const g = v.filter((x) => guestRe.test(x.title) && (x.duration_s || 0) > 1500);
    console.log(`${h} | ${ch.title} | 180d long: ${v.length} | guest-style (>25min): ${g.length} | e.g. ${g.slice(0, 2).map((x) => x.title.slice(0, 50)).join(' // ')}`);
  } catch (e) { console.log(`${h} -- ${e.code || e.message.slice(0, 40)}`); }
}
console.log('units', c.units);
process.exit(0);
