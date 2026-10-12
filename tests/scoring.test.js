import test from 'node:test';
import assert from 'node:assert';
import { buildResults, scoreTopics, scoreGuests, guestRanking, scoreSponsors, median, clamp, engagementRate, channelBaselines } from '../lib/scoring.js';
import { buildDemoDataset } from '../lib/demo.js';

const NOW = new Date('2026-10-11T06:00:00Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
let seq = 0;
const vid = (over) => ({
  video_id: `t${++seq}`, channel_key: 'c1', channel_title: 'Show 1', title: 'x', url: 'https://y/x', published_at: daysAgo(10),
  views: 1000, likes: 50, comments: 5, is_short: false, guests: ['Default Guest'], topics: [], brands: [], ...over,
});

test('demo data gives 6 topics, 7 guests, 5 sponsors in range and sorted', () => {
  const r = buildResults(buildDemoDataset(NOW).videos, NOW);
  assert.equal(r.topics.length, 6);
  const top = r.topics[0].topic;
  assert.equal(r.guests.length, 7);
  assert.equal(r.sponsors.length, 5);
  for (const row of [...r.topics, ...r.guests, ...r.sponsors]) {
    assert.ok(row.probability >= 3 && row.probability <= 97, `${row.probability}`);
    assert.ok(row.evidence.length >= 1);
  }
  for (let i = 1; i < r.topics.length; i++) {
    const a = r.topics[i - 1], b = r.topics[i];
    assert.ok(a.simultaneous.shows > b.simultaneous.shows || (a.simultaneous.shows === b.simultaneous.shows && a.score >= b.score), 'ranked by shows covering it at the same time, then score');
  }
  for (let i = 1; i < r.guests.length; i++) assert.ok(r.guests[i - 1].probability >= r.guests[i].probability, 'guests sorted by probability');
  console.log('\nTOPICS');
  console.table(r.topics.map((t) => ({ rank: t.rank, topic: t.topic, score: t.score, 'prob%': t.probability, videos: t.videos, channels: t.channels })));
  console.log('GUESTS (topic-independent)');
  console.table(r.guests.map((g) => ({ rank: g.rank, guest: g.guest, 'prob%': g.probability, shows: g.shows.length, mediaRound: g.mediaRound })));
  console.log('SPONSORS');
  console.table(r.sponsors.map((s) => ({ rank: s.rank, brand: s.brand, 'prob%': s.probability, mentions: s.mentions, advertiser: s.likelyAdvertiser })));
});

test('helpers handle empty, NaN and null', () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(clamp(NaN, 0, 1), 0);
  assert.equal(engagementRate({ views: 0, likes: 1, comments: 1 }), null);
  assert.equal(engagementRate({ views: 100, likes: null, comments: null }), null);
  assert.equal(engagementRate({ views: 100, likes: null, comments: 10 }), null); // one hidden = missing
  assert.equal(engagementRate({ views: 100, likes: 5, comments: 5 }), 0.1);
});

test('empty and tiny inputs never crash', () => {
  const r = buildResults([], NOW);
  assert.deepEqual(r.topics, []);
  assert.deepEqual(r.sponsors, []);
  const one = buildResults([vid({ topics: ['A'], guests: ['Jo Bo'], brands: [{ name: 'Foo', sponsored: true }] })], NOW);
  assert.equal(one.topics.length, 1); // relaxed to 1 video, no padding
  assert.equal(one.guests.length, 1);
  assert.equal(one.sponsors.length, 1);
  assert.ok(one.notes.fewerTopics && one.notes.fewerGuests && one.notes.fewerSponsors);
});

test('zero views and null likes are safe; all-equal scores tie-break deterministically', () => {
  const vs = ['A', 'B', 'C'].flatMap((t) => [vid({ topics: [t], views: 0, likes: null, comments: null }), vid({ topics: [t], views: 0, likes: null, comments: null, channel_key: 'c2', channel_title: 'Show 2' })]);
  const rows = scoreTopics(vs, NOW);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => Number.isFinite(r.score) && Number.isFinite(r.probability)));
  assert.deepEqual(rows.map((r) => r.topic), ['A', 'B', 'C']);
});

test('immature videos do not count toward performance or hits', () => {
  const vs = [
    vid({ topics: ['New'], published_at: daysAgo(1), views: 5 }),
    vid({ topics: ['New'], published_at: daysAgo(2), views: 5 }),
    ...Array.from({ length: 6 }, (_, i) => vid({ published_at: daysAgo(20 + i), views: 1000 })),
  ];
  const row = scoreTopics(vs, NOW).find((r) => r.topic === 'New');
  assert.equal(row.parts.n, 0);
  assert.equal(row.probability, 50); // (0+1)/(0+2)
});

test('topic probability follows (hits+1)/(n+2)', () => {
  const base = Array.from({ length: 6 }, (_, i) => vid({ published_at: daysAgo(40 + i), views: 1000 }));
  const topicVids = [vid({ topics: ['T'], views: 5000, published_at: daysAgo(10) }), vid({ topics: ['T'], views: 5000, published_at: daysAgo(12) }), vid({ topics: ['T'], views: 10, published_at: daysAgo(14) })];
  const row = scoreTopics([...base, ...topicVids], NOW).find((r) => r.topic === 'T');
  assert.equal(row.parts.hits, 2);
  assert.equal(row.parts.n, 3);
  assert.equal(row.probability, 60); // 3/5
});

test('guests are ranked on their own: no topic involved, media round badge, flooded penalty, never padded', () => {
  const vs = [
    vid({ guests: ['Ann Lee'], topics: ['T1'], channel_key: 'c1', channel_title: 'S1' }),
    vid({ guests: ['Ann Lee'], topics: ['T2'], channel_key: 'c2', channel_title: 'S2', published_at: daysAgo(3) }),
    vid({ guests: ['Bob Ray'], topics: ['Other'], channel_key: 'c3', channel_title: 'S3', published_at: daysAgo(1) }),
  ];
  const g = scoreGuests(vs, NOW);
  assert.equal(g.length, 2);
  assert.equal(g[0].guest, 'Ann Lee'); // two shows beats one, whatever the topic
  assert.ok(g[0].mediaRound && !g[1].mediaRound);
  assert.ok(!('adjacent' in g[0]));
  // changing every topic tag changes nothing
  const retagged = vs.map((v) => ({ ...v, topics: ['Z'] }));
  assert.deepEqual(scoreGuests(retagged, NOW).map((x) => [x.guest, x.probability]), g.map((x) => [x.guest, x.probability]));
  const flooded = Array.from({ length: 6 }, (_, i) => vid({ guests: ['Mega Star'], channel_key: `f${i}`, channel_title: `F${i}` }));
  assert.ok(scoreGuests(flooded, NOW)[0].probability < scoreGuests(flooded.slice(0, 4), NOW)[0].probability);
});

test('topic trend: rising, cooling, new and steady against the previous two weeks', () => {
  const eps = (topic, days) => days.map((d) => vid({ topics: [topic], published_at: daysAgo(d), guests: ['G ' + topic + d] }));
  const vs = [...eps('Up', [1, 3, 5, 8, 20]), ...eps('Down', [2, 15, 17, 19, 21]), ...eps('Fresh', [1, 4, 9, 40, 45]), ...eps('Flat', [3, 6, 16, 18])];
  const by = Object.fromEntries(scoreTopics(vs, NOW).map((r) => [r.topic, r.trend]));
  assert.equal(by.Up.label, 'rising');
  assert.equal(by.Down.label, 'cooling');
  assert.equal(by.Flat.label, 'steady');
  assert.ok(['steady', 'new'].includes(by.Fresh.label));
  assert.equal(by.Up.recent, 4);
});

test('sponsors: advertiser tag, qualification and relaxation', () => {
  const vs = [
    vid({ brands: [{ name: 'PaidCo', sponsored: true }] }),
    vid({ brands: [{ name: 'Mentioned', sponsored: false }] }),
    vid({ brands: [{ name: 'Mentioned', sponsored: false }], channel_key: 'c2', channel_title: 'S2' }),
    vid({ brands: [{ name: 'Once', sponsored: false }] }),
  ];
  const s = scoreSponsors(vs, NOW);
  assert.equal(s.length, 2); // PaidCo (paid) and Mentioned (two shows); a one-off mention never fills the list
  assert.equal(s.find((x) => x.brand === 'PaidCo').likelyAdvertiser, true);
  assert.equal(s.find((x) => x.brand === 'Mentioned').likelyAdvertiser, false);
  assert.ok(!s.some((x) => x.brand === 'Once'));
});

test('channel with one video still gets a baseline', () => {
  const b = channelBaselines([vid({ views: 500 })], NOW);
  assert.equal(b.byChannel.c1.medianViews, 500);
});

test('rarely-posting shows are read further back (max 180 days) so they are not left blank', () => {
  const busy = Array.from({ length: 10 }, (_, i) => vid({ channel_key: 'busy', channel_title: 'Busy', topics: ['T'], guests: ['Bee Guest'], published_at: daysAgo(2 + i * 4) }));
  const rare = [10, 70, 100, 130, 160, 175, 300].map((d) => vid({ channel_key: 'rare', channel_title: 'Rare', topics: ['T'], guests: ['Rare Guest'], published_at: daysAgo(d) }));
  const t = scoreTopics([...busy, ...rare], NOW).find((r) => r.topic === 'T');
  // busy: all 10 are inside 60 days. rare: the newest 6 are used (1 inside 60 days + 5 older); the 300-day one is beyond the 180-day cap.
  assert.equal(t.videos, 10 + 6);
  const withVeryOld = scoreTopics([...busy, ...rare, vid({ channel_key: 'old', channel_title: 'Old', topics: ['T'], guests: ['Old Guest'], published_at: daysAgo(400) })], NOW).find((r) => r.topic === 'T');
  assert.equal(withVeryOld.videos, t.videos, 'nothing older than 180 days is ever used');
});
test('a confirmed guest is removed from the list, everyone else stays, and nothing is hidden automatically', () => {
  const vs = [vid({ guests: ['Ann Lee'], topics: ['T'] }), vid({ guests: ['Bob Ray'], topics: ['T'], channel_key: 'c2', channel_title: 'S2' })];
  assert.equal(scoreGuests(vs, NOW).length, 2);
  assert.deepEqual(scoreGuests(vs, NOW, new Set(['ann lee'])).map((g) => g.guest), ['Bob Ray']);
  const r = buildResults(vs, NOW, { excludeGuests: new Set(['ann lee']) });
  assert.equal(r.excluded, 1);
  assert.equal(r.guests.length, 1);
  assert.equal(buildResults(vs, NOW).guests.length, 2);
});

test('guests: only founders are listed; unknown roles get the benefit of the doubt; media round means 2+ shows within 30 days', () => {
  const info = (name, role, company = '') => [{ name, role, company }];
  const vs = [
    vid({ guests: ['Fay Founder'], guest_info: info('Fay Founder', 'founder', 'Foo Labs'), channel_key: 'a', channel_title: 'A', published_at: daysAgo(5) }),
    vid({ guests: ['Fay Founder'], guest_info: info('Fay Founder', 'founder', 'Foo Labs'), channel_key: 'b', channel_title: 'B', published_at: daysAgo(12) }),
    vid({ guests: ['Ann Analyst'], guest_info: info('Ann Analyst', 'analyst'), channel_key: 'a', channel_title: 'A', published_at: daysAgo(2) }),
    vid({ guests: ['Cal Celeb'], guest_info: info('Cal Celeb', 'celebrity'), channel_key: 'a', channel_title: 'A', published_at: daysAgo(2) }),
    vid({ guests: ['Una Unknown'], guest_info: info('Una Unknown', 'unknown'), channel_key: 'c', channel_title: 'C', published_at: daysAgo(4) }),
    // two shows, but 40 days apart: NOT a media round (not the same month)
    vid({ guests: ['Late Larry'], guest_info: info('Late Larry', 'founder'), channel_key: 'a', channel_title: 'A', published_at: daysAgo(3) }),
    vid({ guests: ['Late Larry'], guest_info: info('Late Larry', 'founder'), channel_key: 'b', channel_title: 'B', published_at: daysAgo(50) }),
  ];
  const r = guestRanking(vs, NOW);
  const names = r.rows.map((g) => g.guest);
  assert.ok(names.includes('Fay Founder') && names.includes('Una Unknown') && names.includes('Late Larry'));
  assert.ok(!names.includes('Ann Analyst') && !names.includes('Cal Celeb'));
  assert.equal(r.skippedNotFounders, 2);
  const fay = r.rows.find((g) => g.guest === 'Fay Founder');
  const larry = r.rows.find((g) => g.guest === 'Late Larry');
  assert.ok(fay.mediaRound && fay.company === 'Foo Labs' && /Founder at Foo Labs/.test(fay.why));
  assert.ok(!larry.mediaRound, 'two shows 47 days apart is not a media round');
  assert.equal(r.mediaRounds, 1);
  assert.equal(names[0], 'Fay Founder', 'the media-round founder ranks first');
  assert.ok(buildResults(vs, NOW).mediaRounds === 1);
});

test('guests: fresh voice and heavily booked tags', () => {
  const fresh = vid({ guests: ['New Face'], guest_info: [{ name: 'New Face', role: 'founder', company: '' }] });
  const busy = Array.from({ length: 6 }, (_, i) => vid({ guests: ['Everywhere Eve'], guest_info: [{ name: 'Everywhere Eve', role: 'founder', company: '' }], channel_key: `s${i}`, channel_title: `S${i}`, published_at: daysAgo(100 + i) }));
  const recent = vid({ guests: ['Everywhere Eve'], guest_info: [{ name: 'Everywhere Eve', role: 'founder', company: '' }], channel_key: 's0', channel_title: 'S0', published_at: daysAgo(4) });
  const rows = scoreGuests([fresh, ...busy, recent], NOW);
  assert.equal(rows.find((g) => g.guest === 'New Face').fresh, true);
  assert.equal(rows.find((g) => g.guest === 'Everywhere Eve').saturated, true);
  assert.equal(rows.find((g) => g.guest === 'Everywhere Eve').fresh, false);
});

test('topics: ranked by how many shows cover them at the same time; ride vs counter-programme vs emerging', () => {
  const eps = (topic, shows, days) => shows.flatMap((s) => days.map((d, i) => vid({ topics: [topic], guests: [`G ${topic} ${s} ${i}`], channel_key: s, channel_title: s, published_at: daysAgo(d) })));
  const vs = [
    ...eps('Crowded', ['s1', 's2', 's3', 's4'], [2, 6, 9, 14]),
    ...eps('Rideable', ['s1', 's2', 's3'], [3, 8]),
    ...eps('Solo', ['s5'], [1, 4, 7, 9, 12, 20]),
    ...eps('Filler', ['s1', 's2', 's3', 's4', 's5', 's6'], [40, 45, 50]),
  ];
  // Filler is only 40+ days old so it is not "simultaneous"; Crowded takes 16 of 36 recent episodes (> 25%)
  const rows = scoreTopics(vs, NOW);
  const by = Object.fromEntries(rows.map((r) => [r.topic, r]));
  assert.equal(by.Crowded.simultaneous.shows, 4);
  assert.equal(by.Rideable.simultaneous.shows, 3);
  assert.equal(by.Solo.simultaneous.shows, 1);
  assert.equal(by.Filler.simultaneous.shows, 0);
  assert.equal(by.Crowded.stance, 'counter');
  assert.equal(by.Rideable.stance, 'ride');
  assert.equal(by.Solo.stance, 'emerging');
  assert.deepEqual(rows.map((r) => r.topic).slice(0, 3), ['Crowded', 'Rideable', 'Solo']);
});

test('sponsors: need two shows or a paid flag; one-off mentions never qualify', () => {
  const vs = [
    vid({ brands: [{ name: 'TwoShows', sponsored: false }], channel_key: 'a', channel_title: 'A' }),
    vid({ brands: [{ name: 'TwoShows', sponsored: false }], channel_key: 'b', channel_title: 'B' }),
    vid({ brands: [{ name: 'PaidOnce', sponsored: true }], channel_key: 'a', channel_title: 'A' }),
    vid({ brands: [{ name: 'OneOff', sponsored: false }], channel_key: 'c', channel_title: 'C' }),
  ];
  const names = scoreSponsors(vs, NOW).map((s) => s.brand);
  assert.ok(names.includes('TwoShows') && names.includes('PaidOnce'));
  assert.ok(!names.includes('OneOff'));
});
