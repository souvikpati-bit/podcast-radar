import test from 'node:test';
import assert from 'node:assert';
import { searchLinks, brandLinks } from '../lib/profiles.js';
import { brandDenied, initialsOf } from '../lib/text.js';

test('search links carry the name and company and point at the right sites', () => {
  const s = searchLinks('Sravanth Aluru', 'Avataar.ai');
  assert.ok(s.google.startsWith('https://www.google.com/search?q=%22Sravanth%20Aluru%22+Avataar.ai'));
  assert.ok(s.linkedin.startsWith('https://www.linkedin.com/search/results/people/?keywords=Sravanth%20Aluru%20Avataar.ai'));
  assert.ok(s.x.startsWith('https://x.com/search?q=Sravanth%20Aluru%20Avataar.ai'));
  assert.ok(s.instagram.includes('site%3Ainstagram.com'));
  assert.deepEqual(Object.keys(s), ['google', 'linkedin', 'x', 'instagram'], 'Google first');
});

test('a missing company still gives a clean search', () => {
  const s = searchLinks('Mohit Gang');
  assert.equal(s.google, 'https://www.google.com/search?q=%22Mohit%20Gang%22');
});

test('brand links search the company pages, Google first', () => {
  const b = brandLinks('Urban Platter');
  assert.deepEqual(Object.keys(b), ['google', 'linkedin', 'x', 'instagram']);
  assert.equal(b.google, 'https://www.google.com/search?q=%22Urban%20Platter%22');
  assert.equal(b.linkedin, 'https://www.linkedin.com/search/results/companies/?keywords=Urban%20Platter');
  assert.ok(b.x.startsWith('https://x.com/search?q=Urban%20Platter') && b.instagram.includes('site%3Ainstagram.com'));
});

test('a brand that is just the initials of one of your own shows is not an advertiser', () => {
  const shows = ['Y Combinator', 'The Neon Show', 'Raj Shamani', 'Prime Venture Partners'];
  assert.equal(initialsOf('Y Combinator'), 'yc');
  assert.equal(initialsOf('The Neon Show'), '', 'one meaningful word has no initials');
  assert.equal(brandDenied('YC', shows), true);
  assert.equal(brandDenied('RS', shows), true);
  assert.equal(brandDenied('PVP', shows), true);
  assert.equal(brandDenied('Porter', shows), false);
  assert.equal(brandDenied('Urban Platter', shows), false);
  assert.equal(brandDenied('YC', []), false, 'without the show in the list nothing changes');
});
