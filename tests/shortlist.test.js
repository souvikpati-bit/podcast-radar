import test from 'node:test';
import assert from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { __setTestClient } from '../lib/db.js';
import { setAction, actionMap } from '../lib/actions.js';
import { shortlistItems, countItems } from '../lib/shortlist-items.js';
import { shortlistDetails, sponsorKey } from '../lib/shortlist.js';
import { buildPayload, renderEmail } from '../lib/brief.js';
import { demoSnapshot } from '../lib/snapshot.js';

const db = new PGlite();
__setTestClient(async (t, p) => (await db.query(t, p)).rows);
Object.assign(process.env, { DATABASE_URL: 'postgres://x' });
delete process.env.GEMINI_API_KEY;
const NOW = new Date('2026-10-12T00:30:00Z');
const data = () => ({ kind: 'demo', snapshot: demoSnapshot(NOW), capturedAt: NOW.toISOString(), stale: false, ageHours: 0 });

test('only shortlisted and contacted marks reach the shortlist, with real names and sorted', () => {
  const details = { topic: { Fundraising: { label: 'Fundraising', sub: 'High response · 5 of 11' } }, guest: {}, sponsor: {} };
  const items = shortlistItems({ 'topic:Fundraising': 'shortlisted', 'topic:Pricing': 'dismissed', 'guest:Ann Lee': 'contacted', 'guest:Bob Ray': 'shortlisted', 'guest:Cy Doe': 'booked', 'sponsor:abc123': 'shortlisted' }, details);
  assert.deepEqual(items.topic.map((i) => i.label), ['Fundraising']);
  assert.deepEqual(items.guest.map((i) => i.key), ['Bob Ray', 'Ann Lee'], 'shortlisted before contacted');
  assert.equal(items.guest[0].links.google.startsWith('https://www.google.com/search'), true, 'a founder not on this week list still gets search links');
  assert.match(items.sponsor[0].label, /no longer on this week/);
  assert.equal(countItems(items), 4, 'dismissed and confirmed are not part of the shortlist');
});

test('details name this week items and mask sponsor names when they are hidden', () => {
  const r = data().snapshot.results;
  const shown = shortlistDetails(r, true);
  const hidden = shortlistDetails(r, false);
  const s0 = r.sponsors[0];
  assert.equal(shown.sponsor[sponsorKey(s0, true)].label, s0.brand);
  assert.equal(hidden.sponsor[sponsorKey(s0, false)].label, `Sponsor ${s0.rank}`);
  assert.ok(!JSON.stringify(hidden).includes(s0.brand), 'no real brand name leaks when names are hidden');
});

test('the Monday email lists what Aditya marked, and leaves the section out when nothing is marked', async () => {
  const d = data();
  const empty = await buildPayload(d);
  assert.equal(countItems(empty.shortlist), 0);
  assert.ok(!renderEmail(empty, 'https://x.test', '12 Oct').html.includes('Your shortlist so far'));

  const topic = d.snapshot.results.topics[0].topic;
  const guest = d.snapshot.results.guests[0].guest;
  await setAction('topic', topic, 'shortlisted');
  await setAction('guest', guest, 'contacted');
  await setAction('guest', 'Someone Else', 'dismissed');
  assert.equal(Object.keys(await actionMap()).length, 3);
  const p = await buildPayload(d);
  assert.equal(countItems(p.shortlist), 2);
  const mail = renderEmail(p, 'https://x.test', '12 Oct');
  assert.ok(mail.html.includes('Your shortlist so far') && mail.html.includes(topic) && mail.html.includes('Contacted'));
  assert.ok(mail.text.includes('YOUR SHORTLIST SO FAR') && mail.text.includes(`Founder: ${guest}`));
  assert.ok(!mail.html.includes('Someone Else'), 'dismissed marks stay out of the email');
});
