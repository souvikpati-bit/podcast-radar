// Display helpers. Times are stored in UTC and shown in IST.
const IST = 'Asia/Kolkata';

export function formatIST(iso, { time = true } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts = time
    ? { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }
    : { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-IN', opts).format(d) + (time ? ' IST' : '');
}

// Monday (UTC) of the week the date falls in, as YYYY-MM-DD. Used as briefs.week_start.
export function weekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function pctLabel(p) {
  return `${Math.round(p)}%`;
}

import scoring from '../config/scoring.json' with { type: 'json' };

export function sourceLine(kind, snapshot, capturedAt) {
  const days = scoring.windows.topicsGuestsDays;
  const r = snapshot.results.counts;
  const base = `Based on ${r.videos} video${r.videos === 1 ? '' : 's'} from ${r.channels} channel${r.channels === 1 ? '' : 's'}, last ${days} days`;
  if (kind === 'demo') return `DEMO DATA. ${base}. These are fictional shows, people and brands.`;
  if (kind === 'snapshot') return `${base}. Last good snapshot from ${formatIST(capturedAt)}`;
  return `${base}, updated ${formatIST(capturedAt)}`;
}
