// Pure helper (safe in the browser too): turns the Review Gate marks into the shortlist rows shown on the page and in the email.
import { searchLinks } from './profiles.js';

export const SHORTLIST_STATUSES = ['shortlisted', 'contacted'];

// actionMap: { 'topic:Fundraising': 'shortlisted', 'guest:Name': 'contacted', ... }
// details: { topic: {name: {label, sub}}, guest: {name: {label, sub, links}}, sponsor: {key: {label, sub}} }
export function shortlistItems(actionMap, details) {
  const out = { topic: [], guest: [], sponsor: [] };
  for (const [k, status] of Object.entries(actionMap || {})) {
    if (!SHORTLIST_STATUSES.includes(status)) continue;
    const i = k.indexOf(':');
    const type = k.slice(0, i);
    const key = k.slice(i + 1);
    if (!out[type]) continue;
    const d = details?.[type]?.[key];
    out[type].push({
      type,
      key,
      status,
      label: d?.label || (type === 'sponsor' ? 'A sponsor no longer on this week’s list' : key),
      sub: d ? d.sub : 'Not on this week’s list',
      links: d?.links || (type === 'guest' ? searchLinks(key, '') : null),
    });
  }
  for (const t of Object.keys(out)) {
    out[t].sort((a, b) => (a.status === b.status ? 0 : a.status === 'shortlisted' ? -1 : 1) || a.label.localeCompare(b.label));
  }
  return out;
}

export const countItems = (items) => items.topic.length + items.guest.length + items.sponsor.length;
