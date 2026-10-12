import test from 'node:test';
import assert from 'node:assert';
import { fetchInterest, attachTrends, weekLabels } from '../lib/trends.js';

const DAY = 86400000;
const now = new Date('2026-10-12T06:00:00Z');
const ts = (daysAgo) => {
  const d = new Date(now.getTime() - daysAgo * DAY);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}00`;
};

// 56 days of data: 100 views a day in the older weeks, 200 a day in the latest two weeks
function wikiFetch(calls = []) {
  return async (url) => {
    calls.push(url);
    if (url.includes('list=search')) return { ok: true, status: 200, json: async () => ({ query: { search: [{ title: 'Space exploration' }] } }) };
    const items = Array.from({ length: 55 }, (_, i) => ({ timestamp: ts(i + 1), views: i < 13 ? 200 : 100 }));
    return { ok: true, status: 200, json: async () => ({ items }) };
  };
}

test('fetchInterest averages daily views per week, oldest first', async () => {
  const v = await fetchInterest(['Artificial intelligence'], now, wikiFetch());
  assert.equal(v.length, 8);
  assert.ok(v[0] === 100 && v[5] === 100, 'older weeks average 100');
  assert.ok(v[7] === 200 && v[6] === 200, 'latest weeks average 200');
});

test('attachTrends adds labels and interest, looks up unknown topics by name, and survives failures', async () => {
  const calls = [];
  const results = { topics: [{ topic: 'AI and agents' }, { topic: 'Spaceflight' }] };
  const out = await attachTrends(results, now, { fetchImpl: wikiFetch(calls) });
  assert.equal(out.trends.weeks.length, 8);
  assert.deepEqual(out.trends.articles['AI and agents'], ['Artificial intelligence']);
  assert.deepEqual(out.trends.articles.Spaceflight, ['Space exploration']);
  assert.equal(out.trends.interest.Spaceflight.length, 8);

  const failing = await attachTrends(results, now, { fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  assert.deepEqual(failing.trends.interest, {});
  assert.ok(failing.trends.error);
  assert.equal(failing.topics.length, 2, 'the results themselves are untouched');
});

test('attachTrends reuses an earlier block instead of calling Wikipedia again', async () => {
  const calls = [];
  const previous = { interest: { 'AI and agents': [1, 2, 3, 4, 5, 6, 7, 8] }, articles: { 'AI and agents': ['Artificial intelligence'] } };
  const out = await attachTrends({ topics: [{ topic: 'AI and agents' }] }, now, { fetchImpl: wikiFetch(calls), previous });
  assert.equal(calls.length, 0);
  assert.deepEqual(out.trends.interest['AI and agents'], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('weekLabels gives eight dates, oldest first', () => {
  const l = weekLabels(now);
  assert.equal(l.length, 8);
  assert.ok(/Aug|Sep/.test(l[0]) && /Oct/.test(l[7]));
});
