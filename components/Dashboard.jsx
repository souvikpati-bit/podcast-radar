'use client';
import { ReviewGate } from './ReviewGate';

const nf = (n) => (n === null || n === undefined ? '' : new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(n));
const day = (iso) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(iso));
const TREND = { rising: 'Rising', cooling: 'Cooling', new: 'New' };
const STANCE = { ride: ['Ride it', 'signal'], counter: ['Crowded: counter-programme', 'amber'], emerging: ['Emerging', ''] };

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

export function Dashboard({ results, admin, actions, demo }) {
  const topics = results.topics;
  const guests = results.guests || [];
  const st = (type, key) => actions[`${type}:${key}`] || '';

  if (!topics.length) {
    return (
      <section className="block" id="topics">
        <div className="empty">
          <h2>No topics yet</h2>
          <p>There is not enough recent guest-episode data. Add shows in Settings and refresh.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="block" id="topics" aria-labelledby="h-topics">
        <div className="sec-head"><span className="sec-num">01</span><h2 id="h-topics">Topics to cover</h2></div>
        <p className="sec-sub">The six themes covered by the most shows at the same time in the last 30 days. &ldquo;Ride it&rdquo; means several shows are on it now. &ldquo;Crowded: counter-programme&rdquo; means it is so widely covered that a fresh angle will stand out more than another take. The trend marker compares the last two weeks with the two before. Probability means the chance a new video on the topic beats its channel&apos;s typical views.</p>
        <ol className="rows">
          {topics.map((t) => (
            <li key={t.topic} className={`row${st('topic', t.topic) === 'dismissed' ? ' dismissed' : ''}`} data-row>
              <div className="rank" aria-hidden="true">{String(t.rank).padStart(2, '0')}</div>
              <div className="row-main">
                <h3 className="row-title">
                  {t.topic}
                  {STANCE[t.stance] && <span className={`badge ${STANCE[t.stance][1]}`}>{STANCE[t.stance][0]}</span>}
                  {TREND[t.trend?.label] && <span className={`badge ${t.trend.label === 'cooling' ? '' : 'signal'}`}>{t.trend.label === 'rising' ? '↑ ' : t.trend.label === 'cooling' ? '↓ ' : ''}{TREND[t.trend.label]}</span>}
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

      <section className="block" id="guests" aria-labelledby="h-guests">
        <div className="sec-head"><span className="sec-num">02</span><h2 id="h-guests">Guests to track</h2></div>
        <p className="sec-sub">Founders appearing across the shows, ranked on their own. This list does not depend on any topic: whoever joins you, you can talk through the trending topics with them. A founder on two or more shows within the same month is on a media round, so they are available and easiest to book now. &ldquo;New voice&rdquo; marks founders with few appearances so far, who are not yet flooded with podcast requests.</p>
        {results.excluded > 0 && <p className="note">{results.excluded} confirmed guest{results.excluded === 1 ? ' is' : 's are'} hidden from this list. You can put them back in Settings.</p>}
        {guests.length > 0 && results.mediaRounds === 0 && <p className="note">No founder has appeared on two or more of your monitored shows in the last 30 days, so nobody is on a media round yet. These are the strongest founders on a single show.</p>}
        {results.mediaRounds > 0 && <p className="note">{results.mediaRounds} founder{results.mediaRounds === 1 ? ' is' : 's are'} on a media round in the last 30 days.</p>}
        {guests.length === 0 ? (
          <p className="note">No guests were found in the data. We never invent a person.</p>
        ) : (
          <ol className="rows">
            {guests.map((g) => (
              <li key={g.guest} className={`row${st('guest', g.guest) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                <div className="rank" aria-hidden="true">{String(g.rank).padStart(2, '0')}</div>
                <div className="row-main">
                  <h3 className="row-title">
                    {g.guest}
                    {g.mediaRound && <span className="badge amber">Media round</span>}
                    {g.fresh && <span className="badge signal">New voice</span>}
                    {g.saturated && <span className="badge">Heavily booked</span>}
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
        {guests.length > 0 && guests.length < 7 && <p className="note">Only {guests.length} guest{guests.length === 1 ? '' : 's'} could be found in the data. The list is never padded.</p>}
      </section>

      <section className="block" id="sponsors" aria-labelledby="h-sponsors">
        <div className="sec-head"><span className="sec-num">03</span><h2 id="h-sponsors">Sponsors to pitch</h2></div>
        <p className="sec-sub">Brands promoted or mentioned across your shows: each appears on two or more shows or shows paid promotion. A founder naming their own company is not counted. This list does not depend on any topic or guest. &ldquo;Likely advertiser&rdquo; means the text showed paid promotion; &ldquo;Mentioned only&rdquo; means it was named without a paid signal. Spoken ad reads are not visible, so brand detection is partial.</p>
        {results.sponsors.length === 0 ? (
          <p className="note">No brands qualified in the last 90 days.</p>
        ) : (
          <ol className="rows">
            {results.sponsors.map((s) => {
              const sk = s.key || s.brand;
              return (
                <li key={sk} className={`row${st('sponsor', sk) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                  <div className="rank" aria-hidden="true">{String(s.rank).padStart(2, '0')}</div>
                  <div className="row-main">
                    <h3 className="row-title">
                      {s.brand}
                      <span className={`badge ${s.likelyAdvertiser ? 'signal' : ''}`}>{s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only'}</span>
                    </h3>
                    <Prob value={s.probability} />
                    <p className="why">{s.why}. Carried by: {s.shows.join(', ')}.</p>
                    <Evidence items={s.evidence} />
                    {admin && <ReviewGate type="sponsor" name={sk} label={s.brand} current={st('sponsor', sk)} />}
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
