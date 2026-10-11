'use client';
import { useRef, useState } from 'react';
import { gsap, useGSAP, Flip } from '@/lib/gsap';
import { ReviewGate } from './ReviewGate';

const nf = (n) => (n === null || n === undefined ? '' : new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(n));
const day = (iso) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(iso));

function Evidence({ items }) {
  if (!items?.length) return null;
  return (
    <div className="chips" aria-label="Source videos">
      {items.map((e) => (
        <a key={e.video_id} className="chip" href={e.url} target="_blank" rel="noopener noreferrer" title={`${e.title} (${e.channel})`}>
          {e.channel}: {e.title.length > 46 ? `${e.title.slice(0, 44)}…` : e.title}
          {e.views !== null && e.views !== undefined ? ` · ${nf(e.views)} views` : ''}
        </a>
      ))}
    </div>
  );
}

function Prob({ value }) {
  return (
    <>
      <div className="meta">
        <span className="mono" style={{ color: 'var(--signal)' }} data-count={Math.round(value)} data-dec="0" data-suffix="%">{Math.round(value)}%</span>
        <span className="est">model estimate from the data</span>
      </div>
      <div className="bar" aria-hidden="true"><i data-bar style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
    </>
  );
}

export function Dashboard({ results, showSponsorNames, admin, actions, demo }) {
  const topics = results.topics;
  const [selected, setSelected] = useState(topics[0]?.topic || '');
  const guests = results.guestsByTopic[selected] || [];
  const topicsList = useRef(null);
  const guestsSection = useRef(null);
  const flipState = useRef(null);
  const hl = useRef(null);

  const { contextSafe } = useGSAP({ scope: topicsList });
  const pick = contextSafe((name) => {
    if (name === selected) return;
    if (hl.current) flipState.current = Flip.getState(hl.current);
    setSelected(name);
  });

  // Move the highlight to the selected row with Flip, and re-stagger the guest list. No spinner: the data is already in the page.
  useGSAP(
    () => {
      const row = topicsList.current?.querySelector('li.selected');
      if (!row) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!hl.current) {
        hl.current = document.createElement('span');
        hl.current.className = 'hl';
        hl.current.setAttribute('aria-hidden', 'true');
      }
      row.prepend(hl.current);
      if (flipState.current && !reduce) {
        Flip.from(flipState.current, { duration: 0.5, ease: 'power3.out', scale: true });
        const rows = guestsSection.current?.querySelectorAll('[data-guest-list] [data-row]');
        if (rows?.length) gsap.fromTo(rows, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out', clearProps: 'transform' });
      }
      flipState.current = null;
    },
    { dependencies: [selected], scope: topicsList },
  );
  const st = (type, key) => actions[`${type}:${key}`] || '';

  if (!topics.length) {
    return (
      <section className="block" id="topics">
        <div className="empty">
          <h2>No topics yet</h2>
          <p>There is not enough recent video data. Add channels in Settings and refresh.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="block" id="topics" aria-labelledby="h-topics" data-reveal>
        <div className="sec-head"><span className="sec-num">01</span><h2 id="h-topics">Topics to cover</h2></div>
        <p className="sec-sub">The six themes the ecosystem is talking about right now. Pick one to see the guests who fit it. Probability here means the chance a new video on the topic beats its channel&apos;s typical views.</p>
        <ol className="rows" ref={topicsList} style={{ position: 'relative' }}>
          {topics.map((t) => (
            <li key={t.topic} className={`row${selected === t.topic ? ' selected' : ''}${st('topic', t.topic) === 'dismissed' ? ' dismissed' : ''}`} data-row>
              <div className="rank mono-serif" aria-hidden="true">{String(t.rank).padStart(2, '0')}</div>
              <div className="row-main">
                <h3 className="row-title">
                  <button type="button" className="pick" aria-pressed={selected === t.topic} onClick={() => pick(t.topic)}>
                    {t.topic} <span className="arrow" aria-hidden="true">→</span>
                  </button>
                  {selected === t.topic && <span className="badge signal">selected</span>}
                </h3>
                <div className="meta"><span className="score mono"><span data-count={t.score.toFixed(1)} data-dec="1">{t.score.toFixed(1)}</span>/10</span><span className="muted">score</span></div>
                <Prob value={t.probability} />
                <p className="why">{t.why}</p>
                <Evidence items={t.evidence} />
                {admin && <ReviewGate type="topic" name={t.topic} current={st('topic', t.topic)} />}
              </div>
            </li>
          ))}
        </ol>
        {results.notes.fewerTopics && <p className="note">Only {topics.length} topic{topics.length === 1 ? '' : 's'} had enough coverage in the data. We never pad the list with invented items.</p>}
      </section>

      <section className="block" id="guests" aria-labelledby="h-guests" ref={guestsSection}>
        <div className="sec-head"><span className="sec-num">02</span><h2 id="h-guests">Guests to book</h2></div>
        <p className="sec-sub">For <strong>{selected}</strong>. Guests on two or more shows in the last 60 days are on a media round, so they are easiest to book now. &ldquo;Adjacent&rdquo; guests fit a nearby topic and only fill the list.</p>
        {results.excluded > 0 && <p className="note">{results.excluded} confirmed guest{results.excluded === 1 ? ' is' : 's are'} hidden from this list. You can put them back in Settings.</p>}
        {guests.length === 0 ? (
          <p className="note">No guests were found for this topic in the data. We never invent a person.</p>
        ) : (
          <ol className="rows" key={selected} data-guest-list>
            {guests.map((g) => (
              <li key={g.guest} className={`row${st('guest', g.guest) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                <div className="rank" aria-hidden="true">{String(g.rank).padStart(2, '0')}</div>
                <div className="row-main">
                  <h3 className="row-title">
                    {g.guest}
                    {g.mediaRound && <span className="badge amber">Media round</span>}
                    {g.adjacent && <span className="badge">adjacent</span>}
                  </h3>
                  <Prob value={g.probability} />
                  <p className="why">{g.why}. Shows: {g.shows.join(', ')}. Last seen {day(g.lastSeen)}.</p>
                  <Evidence items={g.evidence} />
                  {admin && <ReviewGate type="guest" name={g.guest} current={st('guest', g.guest)} />}
                </div>
              </li>
            ))}
          </ol>
        )}
        {guests.length > 0 && guests.length < 7 && <p className="note">Only {guests.length} guest{guests.length === 1 ? '' : 's'} could be found in the data for this topic. The list is never padded.</p>}
      </section>

      <section className="block" id="sponsors" aria-labelledby="h-sponsors" data-reveal>
        <div className="sec-head"><span className="sec-num">03</span><h2 id="h-sponsors">Sponsors to pitch</h2></div>
        <p className="sec-sub">Brands already promoted across the shows. This list does not depend on the topic or guest you picked. &ldquo;Likely advertiser&rdquo; means the text showed paid promotion; &ldquo;Mentioned only&rdquo; means it was named without a paid signal. Spoken ad reads are not visible, so brand detection is partial.</p>
        {results.sponsors.length === 0 ? (
          <p className="note">No brands qualified in the last 90 days.</p>
        ) : (
          <ol className="rows">
            {results.sponsors.map((s) => {
              const label = s.brand;
              const sk = s.key || s.brand;
              return (
                <li key={sk} className={`row${st('sponsor', sk) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                  <div className="rank" aria-hidden="true">{String(s.rank).padStart(2, '0')}</div>
                  <div className="row-main">
                    <h3 className="row-title">
                      {label}
                      <span className={`badge ${s.likelyAdvertiser ? 'signal' : ''}`}>{s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only'}</span>
                    </h3>
                    <Prob value={s.probability} />
                    <p className="why">{s.why}. Carried by: {s.shows.join(', ')}.</p>
                    <Evidence items={s.evidence} />
                    {admin && <ReviewGate type="sponsor" name={sk} label={label} current={st('sponsor', sk)} />}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {results.notes.fewerSponsors && results.sponsors.length > 0 && <p className="note">Only {results.sponsors.length} brand{results.sponsors.length === 1 ? '' : 's'} met the bar. The list is never padded.</p>}
        {demo && <p className="note">These brands are fictional demo data.</p>}
      </section>
    </>
  );
}
