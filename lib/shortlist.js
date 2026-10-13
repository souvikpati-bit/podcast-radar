// Server side: what each topic, guest and sponsor on this week's lists is called, so the shortlist can show real names.
import { createHash } from 'node:crypto';
import { topicVerdict, topicEvidenceLine, orderTopics, VERDICT_LABEL } from './scoring.js';
import { searchLinks } from './profiles.js';

// The key a sponsor is saved under: the brand name, or a short fingerprint when brand names are hidden.
export function sponsorKey(s, showNames) {
  return showNames ? s.key || s.brand : createHash('sha1').update(s.brand).digest('hex').slice(0, 10);
}

export function shortlistDetails(results, showSponsorNames) {
  const topic = {};
  for (const t of orderTopics(results.topics || [])) topic[t.topic] = { label: t.topic, sub: `${VERDICT_LABEL[topicVerdict(t)]} · ${topicEvidenceLine(t)}` };
  const guest = {};
  for (const g of results.guests || []) {
    const role = g.role === 'founder' ? 'Founder' : 'Guest';
    guest[g.guest] = { label: g.guest, sub: g.company ? `${role} at ${g.company}` : role, links: searchLinks(g.guest, g.company) };
  }
  const sponsor = {};
  for (const s of results.sponsors || []) {
    sponsor[sponsorKey(s, showSponsorNames)] = { label: showSponsorNames ? s.brand : `Sponsor ${s.rank}`, sub: `${s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only'} · ${s.shows.join(', ')}` };
  }
  return { topic, guest, sponsor };
}

export { shortlistItems, countItems, SHORTLIST_STATUSES } from './shortlist-items.js';
