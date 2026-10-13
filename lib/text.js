// Text helpers: normalisation for names/brands, description cleaning, escaping.
import cfg from '../config/pipeline.json' with { type: 'json' };

export function stripAccents(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

const TITLE_RE = /^(dr|mr|mrs|ms|prof|sir|shri|smt)\.?\s+/i;

// Lowercase, no accents, no punctuation, single spaces. Used as a comparison key.
export function normKey(s) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGuestName(raw) {
  let s = stripAccents(raw).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(ft\.?|feat\.?|with)\s+/i, '');
  while (TITLE_RE.test(s)) s = s.replace(TITLE_RE, '');
  s = s.replace(/[^A-Za-z.'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean);
  if (words.length < 2) return null; // single-word names are dropped
  if (words.length > 4) return null;
  return words.map((w) => (w === w.toUpperCase() || w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');
}

const BRAND_SUFFIX = /\b(inc|pvt|ltd|llc|limited|private|app|co|corp)\b\.?/gi;

export function normalizeBrandName(raw) {
  const s = stripAccents(raw).replace(BRAND_SUFFIX, ' ').replace(/[^A-Za-z0-9.&+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 40) return null;
  return s;
}

// "Y Combinator" -> "yc". A show's name often appears in short form; that is the show talking about itself, not an advertiser.
const INITIAL_SKIP = new Set(['the', 'and', 'with', 'of', 'by', 'a', 'an', 'show', 'podcast']);
export function initialsOf(title) {
  const words = normKey(title).split(' ').filter((w) => w && !INITIAL_SKIP.has(w));
  return words.length >= 2 ? words.map((w) => w[0]).join('') : '';
}

export function brandDenied(name, extraDenied = []) {
  const k = normKey(name);
  const all = [...cfg.brandDenylist, ...extraDenied].map(normKey);
  if (all.includes(k)) return true;
  return k.length >= 2 && k.length <= 5 && extraDenied.some((t) => initialsOf(t) === k);
}

const SPONSOR_RE = /(sponsored by|brought to you by|partnered with|in partnership with|presented by|powered by|in association with|our partners?\b|official partner|supported by|paid partnership|promo code|use code|coupon|discount code|\d+\s?% off|#ad\b|affiliate|\?ref=|utm_|bit\.ly)/i;
export function hasPaidSignal(text) {
  return SPONSOR_RE.test(text || '');
}

// Keep original links for sponsor detection; produce AI-friendly text without URLs/timestamps/boilerplate.
export function cleanDescription(raw, maxChars = cfg.descriptionMaxChars) {
  let s = String(raw || '');
  s = s.replace(/https?:\/\/\S+/gi, ' ');
  s = s.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
  s = s
    .split(/\r?\n/)
    .filter((l) => !/^(follow|subscribe|connect|find us|listen on|music by|chapters|timestamps|#)/i.test(l.trim()))
    .join('\n');
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return s.slice(0, maxChars);
}

// The brand's own web address, if an episode description names it: a link whose domain is the brand (porter.in for Porter).
// Returns the site's front page, or null. Social networks, link shorteners and marketplaces never count.
const NOT_A_BRAND_SITE = /(^|\.)(instagram|youtube|youtu|facebook|twitter|x|linkedin|bit|linktr|t|wa|whatsapp|amazon|flipkart|spotify|apple|google|goo|tinyurl|ow|lnkd|fb|discord|telegram)\./i;
export function brandWebsite(brand, urls) {
  const token = normKey(String(brand).replace(/\.(com|in|co|io|ai|app|org|net)\b.*$/i, '')).replace(/ /g, '');
  if (token.length < 4) return null;
  const count = new Map();
  for (const raw of urls || []) {
    let u;
    try {
      u = new URL(String(raw).replace(/[)\].,;:!?'"]+$/, ''));
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || NOT_A_BRAND_SITE.test(u.hostname + '.')) continue;
    const base = u.hostname.replace(/^www\./i, '').split('.').slice(0, -1).join('').replace(/[^a-z0-9]/gi, '').toLowerCase();
    // the domain must be the brand's own name (porter / porter.in). A longer, different name (lifespanfitness.com) is another company.
    if (base && base === token) {
      const origin = `https://${u.hostname.replace(/^www\./i, '')}`;
      count.set(origin, (count.get(origin) || 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function extractLinks(raw) {
  return (String(raw || '').match(/https?:\/\/\S+/gi) || []).slice(0, 30);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function parseDurationSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
