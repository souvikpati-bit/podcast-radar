import test from 'node:test';
import assert from 'node:assert';
import { searchLinks, brandLinks } from '../lib/profiles.js';
import { brandDenied, initialsOf, brandWebsite } from '../lib/text.js';
import { verifyWebsites } from '../lib/pipeline.js';

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

test('a brand address is taken from the episode text only when the domain is the brand', () => {
  const urls = ['https://porter.in/enterprise?utm_source=x', 'https://www.instagram.com/porter_in', 'https://bit.ly/abc', 'https://youtu.be/xyz', 'https://other.example/porter'];
  assert.equal(brandWebsite('Porter', urls), 'https://porter.in');
  assert.equal(brandWebsite('Urban Platter', ['https://www.urbanplatter.com/offer)']), 'https://urbanplatter.com');
  assert.equal(brandWebsite('mychronotype.com', ['https://www.mychronotype.com/']), 'https://mychronotype.com');
  assert.equal(brandWebsite('Stripe', ['https://stripe.com/in', 'https://instagram.com/stripe']), 'https://stripe.com');
  assert.equal(brandWebsite('Porter', ['https://instagram.com/porter', 'https://bit.ly/porter']), null, 'social and shorteners never count');
  assert.equal(brandWebsite('YC', ['https://yc.com']), null, 'too short to match safely');
  assert.equal(brandWebsite('Lifespan', ['https://lifespanfitness.com']), null, 'a longer, different name is another company');
});

test('with an address the Google search is specific, and Website comes right after Google', () => {
  const b = brandLinks('Lifespan', 'https://lifespan.com');
  assert.deepEqual(Object.keys(b), ['google', 'website', 'linkedin', 'x', 'instagram']);
  assert.equal(b.google, 'https://www.google.com/search?q=%22Lifespan%22%20lifespan.com');
  assert.equal(b.website, 'https://lifespan.com');
});

test('an address is kept only when the site really answers', async () => {
  const status = { 'https://good.test': 200, 'https://gone.test': 404, 'https://shy.test': 403, 'https://down.test': 503 };
  const f = async (url) => {
    if (url.includes('dead.test')) throw new Error('no route');
    return { status: status[url] };
  };
  const res = await verifyWebsites({ sponsors: [{ website: 'https://good.test' }, { website: 'https://gone.test' }, { website: 'https://shy.test' }, { website: 'https://down.test' }, { website: 'https://dead.test' }, {}] }, f);
  assert.deepEqual(res.sponsors.map((s) => s.website || null), ['https://good.test', null, 'https://shy.test', null, null, null]);
});
