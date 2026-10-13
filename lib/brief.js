// The Monday brief: built from the same stored snapshot the dashboard uses, so numbers never differ.
import { getEnv } from './env.js';
import { query, safeQuery } from './db.js';
import { getDashboardData } from './snapshot.js';
import { generateJson, geminiAvailable } from './gemini.js';
import { escapeHtml } from './text.js';
import { formatIST, sourceLine, weekStart } from './format.js';
import { topicVerdict, topicEvidenceLine, orderTopics, VERDICT_LABEL } from './scoring.js';

export function templateOpening(p) {
  const top = p.topics[0];
  if (!top) return 'There is not enough recent data for a full ranking this week, so this brief shows what the data supports.';
  const g = p.guests[0];
  const s = p.sponsors[0];
  return (
    `This week the strongest topic across the shows is ${top.topic} (rated ${VERDICT_LABEL[topicVerdict(top)]}: ${topicEvidenceLine(top)}).` +
    (g ? ` ${g.guest} is the founder to track first${g.mediaRound ? ', and is already on a media round' : ''}.` : '') +
    (s ? ` ${s.brand ? s.brand : 'The top brand'} shows the strongest sponsor signal.` : '') +
    ' All probabilities are model estimates from the data.'
  );
}

async function geminiOpening(p, counter, fetchImpl) {
  const facts = {
    topics: p.topics.map((t) => ({ topic: t.topic, rating: VERDICT_LABEL[topicVerdict(t)], evidence: topicEvidenceLine(t) })),
    topGuests: p.guests.slice(0, 3).map((g) => ({ guest: g.guest, probabilityPercent: Math.round(g.probability), shows: g.shows.length })),
    topSponsors: p.sponsors.slice(0, 3).map((s) => ({ brand: s.brand, probabilityPercent: Math.round(s.probability), likelyAdvertiser: s.likelyAdvertiser })),
  };
  const out = await generateJson({
    system: 'You write the opening paragraph of a weekly email to a podcast host. Use ONLY the numbers and names supplied. 3 to 4 plain sentences. Do not invent anything. Call probabilities model estimates. Describe topics by their rating (Strong, Average or Weak) and evidence, never by a numeric score. Mention that topics, guests and sponsors follow.',
    prompt: `FACTS (JSON):\n${JSON.stringify(facts)}`,
    schema: { type: 'OBJECT', properties: { summary: { type: 'STRING' } }, required: ['summary'] },
    counter,
    fetchImpl,
  });
  const text = String(out.summary || '').trim();
  if (text.length < 40 || text.length > 900) throw new Error('Unusable summary');
  return text;
}

export async function buildPayload(data, { fetchImpl = fetch, counter = { gemini: 0 } } = {}) {
  const env = getEnv();
  const r = data.snapshot.results;
  const p = {
    kind: data.kind,
    sourceLine: sourceLine(data.kind, data.snapshot, data.capturedAt),
    capturedAt: data.capturedAt,
    topics: orderTopics(r.topics),
    guests: r.guests || [],
    mediaRounds: r.mediaRounds || 0,
    sponsors: r.sponsors.map((s) => (env.showSponsorNames ? s : { ...s, brand: `Sponsor ${s.rank}` })),
    stale: data.stale,
  };
  let opening;
  let usedGemini = false;
  if (geminiAvailable()) {
    try {
      opening = await geminiOpening(p, counter, fetchImpl);
      usedGemini = true;
    } catch {
      opening = templateOpening(p);
    }
  } else {
    opening = templateOpening(p);
  }
  return { ...p, opening, usedGemini };
}

const C = { bg: '#f4f3ee', card: '#ffffff', text: '#14171a', muted: '#5b636b', line: '#e3e1d8', accent: '#4c6b00' };

function row(left, mid, right) {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.4;color:${C.text}">${left}</td><td style="padding:10px 8px;border-bottom:1px solid ${C.line};font-size:13px;color:${C.muted};text-align:right;white-space:nowrap">${mid}</td><td style="padding:10px 0 10px 8px;border-bottom:1px solid ${C.line};font-size:15px;font-weight:700;color:${C.accent};text-align:right;white-space:nowrap">${right}</td></tr>`;
}

export function renderEmail(p, appUrl, weekLabel) {
  const e = escapeHtml;
  const topicRows = p.topics.map((t) => row(`${t.rank}. ${e(t.topic)}${t.stance === 'ride' ? ' <span style="color:#2f6b00;font-size:12px">· ride it</span>' : t.stance === 'counter' ? ' <span style="color:#b36b00;font-size:12px">· crowded: counter-programme</span>' : ''}${t.trend?.label === 'rising' ? ' <span style="color:#2f6b00;font-size:12px">↑ rising</span>' : t.trend?.label === 'cooling' ? ' <span style="color:' + C.muted + ';font-size:12px">↓ cooling</span>' : ''}`, e(topicEvidenceLine(t)), VERDICT_LABEL[topicVerdict(t)])).join('');
  const guestRows = p.guests
    .map((g) => row(`${g.rank}. ${e(g.guest)}${g.mediaRound ? ' <span style="color:#b36b00;font-size:12px">· media round</span>' : ''}${g.fresh ? ' <span style="color:#2f6b00;font-size:12px">· new voice</span>' : ''}<div style="font-size:12px;color:${C.muted}">${e(g.company ? `${g.role === 'founder' ? 'Founder' : 'Guest'} at ${g.company}` : g.role === 'founder' ? 'Founder' : 'Guest')} · ${e(g.shows.join(', '))}</div>`, '', `${Math.round(g.probability)}%`))
    .join('');
  const sponsorRows = p.sponsors
    .map((s) => row(`${s.rank}. ${e(s.brand)}<div style="font-size:12px;color:${C.muted}">${e(s.shows.join(', '))}</div>`, s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only', `${Math.round(s.probability)}%`))
    .join('');
  const h = (t) => `<h2 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:28px 0 4px;color:${C.text}">${e(t)}</h2>`;
  const table = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Podcast Radar: week of ${e(weekLabel)}</title>
<style>@media (prefers-color-scheme: dark){.bg{background:#0b0e11!important}.card{background:#12171c!important}.tx,.tx td,.tx h2{color:#ece9e1!important}.mt{color:#98a0a8!important}}</style></head>
<body class="bg" style="margin:0;padding:0;background:${C.bg}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:${C.bg}"><tr><td align="center" style="padding:16px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td class="card tx" style="background:${C.card};border-radius:10px;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;color:${C.text}">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.accent}">Podcast Ecosystem Radar</div>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;margin:8px 0 14px;color:${C.text}">Your week of ${e(weekLabel)}</h1>
<p style="font-size:15px;line-height:1.55;margin:0;color:${C.text}">${e(p.opening)}</p>
${p.kind === 'demo' ? `<p style="background:#fff4de;color:#7a4a00;padding:8px 10px;border-radius:6px;font-size:13px">Demo data: add your keys and channels to see live numbers.</p>` : ''}
${p.stale ? `<p style="background:#fff4de;color:#7a4a00;padding:8px 10px;border-radius:6px;font-size:13px">Stale data: the last update was more than 36 hours ago.</p>` : ''}
${h('Topics to cover')}${table(topicRows) || ''}
${h('Founders to track')}${p.mediaRounds ? `<p class="mt" style="font-size:13px;color:${C.muted};margin:2px 0 6px">${p.mediaRounds} founder${p.mediaRounds === 1 ? ' is' : 's are'} on a media round this month.</p>` : `<p class="mt" style="font-size:13px;color:${C.muted};margin:2px 0 6px">No founder is on two or more shows this month yet.</p>`}${p.guests.length ? table(guestRows) : `<p class="mt" style="font-size:14px;color:${C.muted}">No guests found in the data.</p>`}
${h('Sponsors to pitch')}${p.sponsors.length ? table(sponsorRows) : `<p class="mt" style="font-size:14px;color:${C.muted}">No brands met the bar this week.</p>`}
<p style="margin:26px 0 8px"><a href="${e(appUrl)}/" style="background:#c6f432;color:#000;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px;display:inline-block;font-size:14px">Open the dashboard</a></p>
<p class="mt" style="font-size:12px;line-height:1.5;color:${C.muted};margin:18px 0 0">${e(p.sourceLine)}. Every probability is a model estimate from the data, not a guarantee. This tool never contacts a guest or a sponsor.</p>
</td></tr></table></td></tr></table></body></html>`;
  const lines = [
    `PODCAST ECOSYSTEM RADAR: week of ${weekLabel}`,
    '',
    p.opening,
    '',
    'TOPICS TO COVER',
    ...p.topics.map((t) => `${t.rank}. ${t.topic}  ${VERDICT_LABEL[topicVerdict(t)]} (${topicEvidenceLine(t)})${t.stance === 'ride' ? '  [ride it]' : t.stance === 'counter' ? '  [crowded: counter-programme]' : ''}${t.trend?.label === 'rising' ? '  [rising]' : t.trend?.label === 'cooling' ? '  [cooling]' : ''}`),
    '',
    'FOUNDERS TO TRACK',
    p.mediaRounds ? `${p.mediaRounds} founder(s) on a media round this month.` : 'No founder is on two or more shows this month yet.',
    ...(p.guests.length ? p.guests.map((g) => `${g.rank}. ${g.guest}  ${Math.round(g.probability)}%${g.mediaRound ? '  [media round]' : ''}${g.fresh ? '  [new voice]' : ''}${g.company ? '  ' + g.company : ''}`) : ['None found in the data.']),
    '',
    'SPONSORS TO PITCH',
    ...(p.sponsors.length ? p.sponsors.map((s) => `${s.rank}. ${s.brand}  ${Math.round(s.probability)}%  ${s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only'}`) : ['None met the bar this week.']),
    '',
    `Dashboard: ${appUrl}/`,
    '',
    `${p.sourceLine}. Every probability is a model estimate from the data, not a guarantee.`,
  ];
  return { html, text: lines.join('\n') };
}

// Explain the exact cause when Resend refuses.
export function explainResendError(status, body) {
  const msg = String(body?.message || body?.error || '').slice(0, 200);
  if (status === 401 || status === 403) {
    if (/own email|verify a domain|testing emails/i.test(msg)) {
      return 'Resend only delivers to your own Resend account email until you verify a domain. Set BRIEF_TO_EMAIL to that address (or verify a domain in Resend).';
    }
    return `Resend rejected the API key (${status}). Check RESEND_API_KEY. ${msg}`;
  }
  if (status === 422) return `Resend rejected the message: ${msg}. Check RESEND_FROM and BRIEF_TO_EMAIL.`;
  if (status === 429) return 'Resend rate limit reached. It will retry on the next daily run.';
  return `Resend error ${status}: ${msg}`;
}

export function emailConfigProblem() {
  const e = getEnv();
  const missing = [];
  if (!e.resendKey) missing.push('RESEND_API_KEY');
  if (!e.briefTo) missing.push('BRIEF_TO_EMAIL');
  if (missing.length) return `Cannot send: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Add ${missing.length > 1 ? 'them' : 'it'} in .env.local and in Vercel (Production), then redeploy.`;
  return null;
}

// Record a failure so the daily run retries it. Never overwrites a sent brief.
async function markFailed(week, error) {
  await query(
    `INSERT INTO briefs (week_start, status, error) VALUES ($1,'failed',$2)
     ON CONFLICT (week_start) DO UPDATE SET status='failed', error=EXCLUDED.error WHERE briefs.status <> 'sent'`,
    [week, String(error).slice(0, 300)],
  );
}

// True when this week's brief is missing, failed, or stuck as a draft: the daily run should try again.
export async function briefNeedsRetry(now = new Date()) {
  const r = await safeQuery(`SELECT status, created_at FROM briefs WHERE week_start = $1`, [weekStart(now)]);
  if (!r.ok) return false;
  const row = r.rows[0];
  if (!row) return true;
  if (row.status === 'failed') return true;
  return row.status === 'draft' && Date.now() - new Date(row.created_at).getTime() > 5 * 60000;
}

// Send (or resend) this week's brief. Idempotent: a week that is already sent is never sent twice unless force is true.
export async function sendBrief({ force = false, now = new Date(), fetchImpl = fetch, data = null } = {}) {
  const dbCheck = await safeQuery('SELECT 1');
  if (!dbCheck.ok) return { ok: false, error: 'The database is not available, so the brief cannot be recorded or sent.' };
  const env = getEnv();
  const week = weekStart(now);
  const existing = await query('SELECT status FROM briefs WHERE week_start = $1', [week]);
  if (existing[0]?.status === 'sent' && !force) return { ok: true, already: true, message: `This week's brief (${week}) was already sent. Use Resend brief to send it again.` };
  const problem = emailConfigProblem();
  if (problem) {
    await markFailed(week, problem);
    return { ok: false, error: problem };
  }

  const counter = { gemini: 0 };
  let payload;
  let html;
  let text;
  try {
    const dash = data || (await getDashboardData(now));
    payload = await buildPayload(dash, { fetchImpl, counter });
    ({ html, text } = renderEmail(payload, env.appUrl, week));
  } catch (err) {
    const msg = `Could not build the brief: ${String(err.message).slice(0, 120)}`;
    await markFailed(week, msg);
    return { ok: false, error: msg };
  }

  // Atomic claim: only one caller can move this week into 'draft'.
  const claim = await query(
    `INSERT INTO briefs (week_start, status, payload_json, html, text_body) VALUES ($1,'draft',$2::jsonb,$3,$4)
     ON CONFLICT (week_start) DO UPDATE SET status='draft', payload_json=EXCLUDED.payload_json, html=EXCLUDED.html, text_body=EXCLUDED.text_body, error=NULL, created_at=now()
     WHERE briefs.status='failed' OR (briefs.status='draft' AND briefs.created_at < now() - interval '5 minutes') OR $5::boolean
     RETURNING id`,
    [week, JSON.stringify(payload), html, text, force],
  );
  if (!claim[0]) return { ok: true, already: true, message: `This week's brief (${week}) is already sent or being sent.` };

  const idem = force ? `brief-${week}-${now.getTime()}` : `brief-${week}`;
  let res;
  try {
    res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.resendKey}`, 'content-type': 'application/json', 'Idempotency-Key': idem },
      body: JSON.stringify({ from: `Podcast Radar <${env.resendFrom}>`, to: [env.briefTo], subject: `Podcast Radar: week of ${week}`, html, text }),
    });
  } catch {
    await query(`UPDATE briefs SET status='failed', error=$1 WHERE week_start=$2`, ['Could not reach Resend', week]);
    return { ok: false, error: 'Could not reach Resend. It will retry on the next daily run.' };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = explainResendError(res.status, body);
    await query(`UPDATE briefs SET status='failed', error=$1 WHERE week_start=$2`, [error.slice(0, 300), week]);
    await query(`INSERT INTO runs (kind, status, finished_at, gemini_calls, failures_json) VALUES ('brief','failed', now(), $1, $2::jsonb)`, [counter.gemini, JSON.stringify([{ channel: 'Resend', reason: error.slice(0, 160) }])]);
    return { ok: false, error };
  }
  await query(`UPDATE briefs SET status='sent', sent_at=now(), error=NULL WHERE week_start=$1`, [week]);

  await query(`INSERT INTO runs (kind, status, finished_at, gemini_calls, emails_sent) VALUES ('brief','ok', now(), $1, 1)`, [counter.gemini]);
  return { ok: true, message: `Brief sent to ${env.briefTo} (${formatIST(now.toISOString())}). Archive: /briefs/${week}`, week };
}
