// Persistent topic taxonomy: free-text tags are mapped onto stable canonical names (max 14).
import seed from '../config/taxonomy.json' with { type: 'json' };
import cfg from '../config/pipeline.json' with { type: 'json' };
import { normKey } from './text.js';

export function defaultTaxonomy() {
  return seed.topics.map((t) => ({ canonical_name: t.name, aliases: [...t.aliases] }));
}

const tokens = (s) => new Set(normKey(s).split(' ').filter((w) => w.length > 2));

function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

// Returns the canonical name that fits, or null.
export function mapTag(tag, taxonomy) {
  const k = normKey(tag);
  if (!k) return null;
  for (const t of taxonomy) {
    if (normKey(t.canonical_name) === k) return t.canonical_name;
    if (t.aliases.some((a) => normKey(a) === k)) return t.canonical_name;
  }
  let best = null;
  let bestScore = 0;
  for (const t of taxonomy) {
    for (const cand of [t.canonical_name, ...t.aliases]) {
      const s = overlap(k, cand);
      if (s > bestScore) {
        bestScore = s;
        best = t.canonical_name;
      }
    }
  }
  return bestScore >= 0.67 ? best : null;
}

// Map many tags. New canonical names are created only when nothing fits and there is room.
export function mapTags(tags, taxonomy) {
  const out = [];
  const tax = taxonomy;
  const unmapped = [];
  for (const raw of tags || []) {
    const name = mapTag(raw, tax);
    if (name) {
      if (!out.includes(name)) out.push(name);
    } else {
      unmapped.push(raw);
    }
  }
  return { topics: out, unmapped };
}

export function addCanonical(tag, taxonomy) {
  const clean = String(tag).replace(/[^A-Za-z0-9&\s\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!clean || taxonomy.length >= cfg.maxTaxonomyTopics) return null;
  const name = clean[0].toUpperCase() + clean.slice(1);
  if (!taxonomy.some((t) => normKey(t.canonical_name) === normKey(name))) taxonomy.push({ canonical_name: name, aliases: [normKey(name)] });
  return name;
}
