// Founder profile links. Nothing here is guessed: a link is shown as a profile only when Aditya pasted it himself.
// Everything else is a ready-made SEARCH link (clearly labelled as a search) so he is one click from the right person.
import { safeQuery } from './db.js';
import { normKey } from './text.js';

const RESERVED_X = new Set(['search', 'home', 'i', 'intent', 'share', 'explore', 'hashtag', 'settings', 'login', 'signup', 'messages', 'notifications', 'compose']);
const RESERVED_IG = new Set(['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'direct', 'tv']);

// Turns a pasted address into { network, url } in one clean form, or null if it is not a personal profile page.
export function normalizeProfileUrl(input) {
  let u;
  try {
    u = new URL(String(input || '').trim().slice(0, 300));
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|in)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'linkedin.com' && parts[0] === 'in' && /^[\p{L}\p{N}%._-]{2,100}$/u.test(parts[1] || '')) {
    return { network: 'linkedin', url: `https://www.linkedin.com/in/${parts[1]}` };
  }
  if ((host === 'x.com' || host === 'twitter.com') && /^[A-Za-z0-9_]{1,15}$/.test(parts[0] || '') && !RESERVED_X.has(parts[0].toLowerCase())) {
    return { network: 'x', url: `https://x.com/${parts[0]}` };
  }
  if (host === 'instagram.com' && /^[A-Za-z0-9._]{1,30}$/.test(parts[0] || '') && !RESERVED_IG.has(parts[0].toLowerCase())) {
    return { network: 'instagram', url: `https://www.instagram.com/${parts[0]}/` };
  }
  return null;
}

// Search links only. They land on a results page where the person is usually first, because the company is in the query.
export function searchLinks(name, company = '') {
  const q = encodeURIComponent([name, company].filter(Boolean).join(' '));
  const gq = encodeURIComponent(`${[name, company].filter(Boolean).join(' ')}`);
  return {
    linkedin: `https://www.linkedin.com/search/results/people/?keywords=${q}`,
    x: `https://x.com/search?q=${q}&f=user`,
    instagram: `https://www.google.com/search?q=${gq}+site%3Ainstagram.com`,
    google: `https://www.google.com/search?q=${encodeURIComponent(`"${name}"`)}+${encodeURIComponent(company)}`,
  };
}

export async function profileMap() {
  const r = await safeQuery('SELECT guest_key, linkedin, x, instagram FROM founder_profiles');
  return Object.fromEntries((r.rows || []).map((p) => [p.guest_key, { linkedin: p.linkedin, x: p.x, instagram: p.instagram }]));
}

export async function saveProfile(guest, input) {
  const name = String(guest || '').trim().slice(0, 120);
  const key = normKey(name);
  if (!key) throw new Error('Missing founder name');
  const p = normalizeProfileUrl(input);
  if (!p) throw new Error('Paste a LinkedIn (linkedin.com/in/...), X or Instagram profile link');
  const col = p.network; // 'linkedin' | 'x' | 'instagram' (fixed list, never user text)
  const r = await safeQuery(
    `INSERT INTO founder_profiles (guest_key, guest_name, ${col}) VALUES ($1,$2,$3)
     ON CONFLICT (guest_key) DO UPDATE SET ${col} = EXCLUDED.${col}, guest_name = EXCLUDED.guest_name, updated_at = now()`,
    [key, name, p.url],
  );
  if (!r.ok) throw new Error(r.error);
  return p;
}

export async function removeProfile(guest, network) {
  if (!['linkedin', 'x', 'instagram'].includes(network)) throw new Error('Unknown network');
  const key = normKey(guest);
  if (!key) throw new Error('Missing founder name');
  const r = await safeQuery(`UPDATE founder_profiles SET ${network} = NULL, updated_at = now() WHERE guest_key = $1`, [key]);
  if (!r.ok) throw new Error(r.error);
}
