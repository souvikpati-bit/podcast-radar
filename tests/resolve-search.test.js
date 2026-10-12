import test from 'node:test';
import assert from 'node:assert';
import { guessHandles, resolveChannel, newUnitCounter } from '../lib/youtube.js';

process.env.YOUTUBE_API_KEY = 'k';

test('a YouTube search link is turned into likely handles, longest first', () => {
  const h = guessHandles('https://www.youtube.com/results?search_query=Prime+Venture+Partners+Podcast');
  assert.deepEqual(h, ['@PrimeVenturePartnersPodcast', '@PrimeVenturePartners', '@PrimeVenture', '@Prime']);
});

test('plain show names work, other links and single words do not', () => {
  assert.deepEqual(guessHandles('Raj Shamani'), ['@RajShamani', '@Raj']);
  assert.deepEqual(guessHandles('https://example.com/page'), []);
  assert.deepEqual(guessHandles('x'), []);
});

test('resolveChannel tries the guesses until one exists and counts one unit per try', async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    const handle = new URL(url).searchParams.get('forHandle');
    asked.push(handle);
    const items = handle === '@PrimeVenturePartners' ? [{ id: 'UCabcdefghijklmnopqrstuv', snippet: { title: 'Prime Venture Partners', thumbnails: {} }, contentDetails: { relatedPlaylists: { uploads: 'UUx' } } }] : [];
    return { ok: true, status: 200, json: async () => ({ items }) };
  };
  const counter = newUnitCounter();
  const ch = await resolveChannel('https://www.youtube.com/results?search_query=Prime+Venture+Partners+Podcast', counter, fetchImpl);
  assert.equal(ch.title, 'Prime Venture Partners');
  assert.equal(ch.handle, '@PrimeVenturePartners');
  assert.deepEqual(asked, ['@PrimeVenturePartnersPodcast', '@PrimeVenturePartners']);
  assert.equal(counter.units, 2);
});

test('when nothing matches the error says what to paste instead', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) });
  await assert.rejects(() => resolveChannel('Some Unknown Show Name', newUnitCounter(), fetchImpl), /channel page/);
});
