import test from 'node:test';
import assert from 'node:assert';
import { normalizeProfileUrl, searchLinks } from '../lib/profiles.js';

test('real profile links are recognised and cleaned', () => {
  assert.deepEqual(normalizeProfileUrl('https://www.linkedin.com/in/sravanth/?utm_source=x#top'), { network: 'linkedin', url: 'https://www.linkedin.com/in/sravanth' });
  assert.deepEqual(normalizeProfileUrl('https://in.linkedin.com/in/sumant-sinha/'), { network: 'linkedin', url: 'https://www.linkedin.com/in/sumant-sinha' });
  assert.deepEqual(normalizeProfileUrl('https://twitter.com/AluruSravanth?s=20'), { network: 'x', url: 'https://x.com/AluruSravanth' });
  assert.deepEqual(normalizeProfileUrl('https://x.com/sumant_sinha'), { network: 'x', url: 'https://x.com/sumant_sinha' });
  assert.deepEqual(normalizeProfileUrl('https://www.instagram.com/alurusravanth/'), { network: 'instagram', url: 'https://www.instagram.com/alurusravanth/' });
});

test('anything that is not a personal profile page is rejected', () => {
  for (const bad of ['', 'javascript:alert(1)', 'https://evil.example/in/sravanth', 'https://linkedin.com/company/yourstory-com', 'https://linkedin.com/in/', 'https://x.com/search?q=a', 'https://x.com/home', 'https://www.instagram.com/p/ABC123/', 'https://linkedin.com.evil.example/in/sravanth', 'not a url', 'ftp://linkedin.com/in/a1']) {
    assert.equal(normalizeProfileUrl(bad), null, bad);
  }
});

test('search links carry the name and company and point at the right sites', () => {
  const s = searchLinks('Sravanth Aluru', 'Avataar.ai');
  assert.ok(s.linkedin.startsWith('https://www.linkedin.com/search/results/people/?keywords=Sravanth%20Aluru%20Avataar.ai'));
  assert.ok(s.x.startsWith('https://x.com/search?q=Sravanth%20Aluru%20Avataar.ai'));
  assert.ok(s.instagram.includes('site%3Ainstagram.com'));
  assert.ok(s.google.startsWith('https://www.google.com/search?q='));
});

import { PGlite } from '@electric-sql/pglite';
import { __setTestClient } from '../lib/db.js';
import { saveProfile, removeProfile, profileMap } from '../lib/profiles.js';

test('a saved profile is remembered per founder, one network at a time, and can be removed', async () => {
  const db = new PGlite();
  __setTestClient(async (t, p) => (await db.query(t, p)).rows);
  process.env.DATABASE_URL = 'postgres://test';
  await saveProfile('Sravanth Aluru', 'https://www.linkedin.com/in/sravanth/');
  await saveProfile('Sravanth  Aluru', 'https://twitter.com/AluruSravanth');
  let map = await profileMap();
  assert.deepEqual(map['sravanth aluru'], { linkedin: 'https://www.linkedin.com/in/sravanth', x: 'https://x.com/AluruSravanth', instagram: null });
  await assert.rejects(() => saveProfile('Sravanth Aluru', 'https://example.com/in/x'), /Paste a LinkedIn/);
  await removeProfile('Sravanth Aluru', 'x');
  map = await profileMap();
  assert.equal(map['sravanth aluru'].x, null);
  assert.equal(map['sravanth aluru'].linkedin, 'https://www.linkedin.com/in/sravanth');
  await assert.rejects(() => removeProfile('Sravanth Aluru', 'drop table'), /Unknown network/);
});
