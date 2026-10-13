import test from 'node:test';
import assert from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { __setTestClient } from '../lib/db.js';
import { sendBrief, renderEmail, templateOpening, buildPayload } from '../lib/brief.js';
import { demoSnapshot } from '../lib/snapshot.js';
import { makeToken, verifyToken, requireCron, safeEqual, requireAdmin } from '../lib/auth.js';
import { checkLogin } from '../lib/login.js';
import { actionsToCsv, setAction, listActions, impactCounts } from '../lib/actions.js';

const db = new PGlite();
__setTestClient(async (t, p) => (await db.query(t, p)).rows);
Object.assign(process.env, { DATABASE_URL: 'postgres://x', ADMIN_KEY: 'sesame', CRON_SECRET: 'cronsecret' });
delete process.env.GEMINI_API_KEY;
const clearMail = () => { delete process.env.RESEND_API_KEY; delete process.env.BRIEF_TO_EMAIL; };
const setMail = () => Object.assign(process.env, { RESEND_API_KEY: 're_test', BRIEF_TO_EMAIL: 'me@example.com' });

const NOW = new Date('2026-10-12T00:30:00Z'); // a Monday
const data = () => ({ kind: 'demo', snapshot: demoSnapshot(NOW), capturedAt: NOW.toISOString(), stale: false, ageHours: 0 });

test('missing email settings give a clear message', async () => {
  clearMail();
  const r = await sendBrief({ now: NOW, data: data() });
  assert.equal(r.ok, false);
  assert.match(r.error, /RESEND_API_KEY and BRIEF_TO_EMAIL/);
});

test('brief sends once, never twice; failure is stored then retried', async () => {
  setMail();
  let calls = 0;
  let mode = 'forbidden';
  const f = async (url, o) => {
    calls++;
    if (mode === 'forbidden') return { ok: false, status: 403, json: async () => ({ message: 'You can only send testing emails to your own email address' }) };
    return { ok: true, status: 200, json: async () => ({ id: 'e1' }) };
  };
  const r1 = await sendBrief({ now: NOW, data: data(), fetchImpl: f });
  assert.equal(r1.ok, false);
  assert.match(r1.error, /own Resend account email/);
  assert.equal((await db.query('SELECT status FROM briefs')).rows[0].status, 'failed');
  mode = 'ok';
  const r2 = await sendBrief({ now: NOW, data: data(), fetchImpl: f });
  assert.equal(r2.ok, true);
  assert.equal(calls, 2);
  const r3 = await sendBrief({ now: NOW, data: data(), fetchImpl: f });
  assert.equal(r3.already, true);
  assert.equal(calls, 2, 'a repeat run must not send another email');
  const row = (await db.query('SELECT status, html, text_body FROM briefs')).rows[0];
  assert.equal(row.status, 'sent');
  assert.ok(row.html.includes('Podcast Ecosystem Radar') && row.text_body.includes('TOPICS TO COVER'));
});

test('email escapes untrusted text, obeys sponsor-name setting, falls back without Gemini', async () => {
  const d = data();
  d.snapshot.results.guests[0].guest = '<script>alert(1)</script>';
  const p = await buildPayload(d);
  assert.equal(p.usedGemini, false);
  assert.ok(p.opening.length > 40);
  const { html } = renderEmail(p, 'https://app.test', '2026-10-12');
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
  process.env.SHOW_SPONSOR_NAMES = 'false';
  const hidden = await buildPayload(data());
  assert.match(hidden.sponsors[0].brand, /^Sponsor \d$/);
  process.env.SHOW_SPONSOR_NAMES = 'true';
  assert.ok(templateOpening({ topics: [], guests: [], sponsors: [] }).length > 10);
});

test('Gemini opening is used when valid and falls back when it fails', async () => {
  process.env.GEMINI_API_KEY = 'g';
  const good = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'This week AI agents lead the ranking with strong odds. Guests and sponsors follow below, all as model estimates.' }) }] } }] }) });
  assert.equal((await buildPayload(data(), { fetchImpl: good })).usedGemini, true);
  const bad = async () => ({ ok: false, status: 400, json: async () => ({}) });
  assert.equal((await buildPayload(data(), { fetchImpl: bad })).usedGemini, false);
  delete process.env.GEMINI_API_KEY;
});

test('auth: tokens, cron secret, login throttle', async () => {
  const t = makeToken();
  assert.ok(verifyToken(t));
  assert.ok(!verifyToken(t + 'x'));
  assert.ok(!verifyToken('1.abc'));
  assert.ok(!verifyToken(makeToken(Date.now() - 8 * 86400000)));
  assert.ok(safeEqual('a', 'a') && !safeEqual('a', 'b') && !safeEqual('a', 'aa'));
  assert.equal(requireCron(new Request('http://x/api/cron/refresh')).status, 401);
  assert.equal(requireCron(new Request('http://x', { headers: { authorization: 'Bearer wrong' } })).status, 401);
  assert.equal(requireCron(new Request('http://x', { headers: { authorization: 'Bearer cronsecret' } })), null);
  assert.equal(requireAdmin(new Request('http://x', { method: 'POST' })).status, 401);
  assert.equal(requireAdmin(new Request('http://x', { method: 'POST', headers: { cookie: `radar_admin=${t}` } })), null);
  for (let i = 0; i < 5; i++) assert.equal((await checkLogin('9.9.9.9', 'nope')).status, 401);
  assert.equal((await checkLogin('9.9.9.9', 'sesame')).status, 429); // throttled even with the right key
  assert.equal((await checkLogin('1.1.1.1', 'sesame')).ok, true);
});

test('Review Gate stores statuses and exports safe CSV', async () => {
  await setAction('guest', 'Jane Doe', 'booked');
  await setAction('sponsor', '=cmd|calc', 'sponsored', 'note, with "quotes"');
  await setAction('topic', 'AI', 'shortlisted');
  await setAction('topic', 'AI', 'clear');
  const rows = await listActions();
  assert.equal(rows.length, 2);
  assert.deepEqual(impactCounts(rows), { guestsBooked: 1, sponsorsWon: 1 });
  const csv = actionsToCsv(rows);
  assert.ok(csv.includes(`"'=cmd|calc"`));
  await assert.rejects(() => setAction('guest', 'x', 'weird'));
});

test('a brief that fails before sending is stored and retried by the daily run', async () => {
  const { briefNeedsRetry } = await import('../lib/brief.js');
  const d3 = new PGlite();
  __setTestClient(async (t, p) => (await d3.query(t, p)).rows);
  clearMail();
  const later = new Date('2026-11-02T00:30:00Z');
  assert.equal(await briefNeedsRetry(later), true); // no row yet
  const r = await sendBrief({ now: later, data: data() });
  assert.equal(r.ok, false);
  assert.equal((await d3.query('SELECT status FROM briefs')).rows[0].status, 'failed');
  assert.equal(await briefNeedsRetry(later), true);
  setMail();
  const ok = await sendBrief({ now: later, data: data(), fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  assert.equal(ok.ok, true);
  assert.equal(await briefNeedsRetry(later), false);
});
