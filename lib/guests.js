// Guest name merging: normalise, alias table, safe fuzzy matching. Ambiguous pairs are logged, not merged.
import { normKey } from './text.js';

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

// 'same' | 'maybe' | 'no'
export function compareNames(a, b) {
  const ka = normKey(a);
  const kb = normKey(b);
  if (ka === kb) return 'same';
  const ta = ka.split(' ');
  const tb = kb.split(' ');
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  const firstA = ta[0];
  const firstB = tb[0];
  if (lastA === lastB) {
    if (firstA === firstB) return 'same'; // middle name differences only
    const [s, l] = firstA.length <= firstB.length ? [firstA, firstB] : [firstB, firstA];
    if (s.length >= 3 && l.startsWith(s)) return 'same'; // Jon / Jonathan
    if (s[0] === l[0]) return 'maybe'; // initial only matches: not safe to merge
    return 'no';
  }
  if (ka.length >= 9 && lev(ka, kb) <= 1) return 'same'; // typo
  return 'no';
}

// names: array of display names. aliasMap: { alias_key: canonical_name } (editable table).
// Returns { map: {name -> canonical}, ambiguous: [[a,b],...] }
export function mergeGuestNames(names, aliasMap = {}) {
  const map = {};
  const canon = [];
  const ambiguous = [];
  for (const name of names) {
    const aliased = aliasMap[normKey(name)];
    if (aliased) {
      map[name] = aliased;
      if (!canon.includes(aliased)) canon.push(aliased);
      continue;
    }
    let found = null;
    for (const c of canon) {
      const r = compareNames(name, c);
      if (r === 'same') {
        found = c;
        break;
      }
      if (r === 'maybe') ambiguous.push([name, c]);
    }
    if (found) {
      map[name] = found;
    } else {
      map[name] = name;
      canon.push(name);
    }
  }
  return { map, ambiguous };
}
