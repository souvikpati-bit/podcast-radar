import { ReviewGate } from './ReviewGate';
import { ProbRing } from './ProbRing';
import { Sparkline } from './Sparkline';
import { TrendChart } from './TrendChart';
import { FounderLinks } from './FounderLinks';
import { FounderSummary } from './FounderSummary';
import { searchLinks } from '@/lib/profiles';

const nf = (n) => (n === null || n === undefined ? '' : new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(n));
const day = (iso) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(iso));
const TREND = { rising: '↑ Rising', cooling: '↓ Cooling', new: 'New' };
const STANCE = { ride: ['Ride it', 'signal'], counter: ['Crowded: counter-programme', 'amber'], emerging: ['Emerging', ''] };

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hueOf = (name) => [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

function Evidence({ items }) {
  if (!items?.length) return null;
  return (
    <div className="chips" aria-label="Source videos">
      {items.map((e) => (
        <a key={e.video_id} className="chip" href={e.url} target="_blank" rel="noopener noreferrer" title={`${e.title} (${e.channel})`}>
          <b className="ev-ch">{e.channel}</b> {e.title.length > 40 ? `${e.title.slice(0, 38)}…` : e.title}
          {e.views !== null && e.views !== undefined ? <span className="ev-v"> · {nf(e.views)} views</span> : ''}
        </a>
      ))}
    </div>
  );
}

function Prob({ value }) {
  return (
    <div className="prob">
      <div className="meta">
        <span className="mono" style={{ color: 'var(--signal)' }} data-count={Math.round(value)} data-dec="0" data-suffix="%">{Math.round(value)}%</span>
        <span className="est">model estimate from the data</span>
      </div>
      <div className="bar" aria-hidden="true"><i data-bar style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function SectionHead({ num, id, title, children }) {
  return (
    <header className="sec-head">
      <span className="sec-num" aria-hidden="true">{num}</span>
      <h2 id={id}>{title}</h2>
      {children && <p className="sec-sub">{children}</p>}
    </header>
  );
}

export function TopicsPanel({ results, admin, actions }) {
  const topics = results.topics;
  const totalShows = Math.min(results.counts.channels || 0, 14);
  const st = (type, key) => actions[`${type}:${key}`] || '';
  if (!topics.length) {
    return (
      <section className="block">
        <div className="empty">
          <h2>No topics yet</h2>
          <p>There is not enough recent guest-episode data. Add shows and refresh.</p>
        </div>
      </section>
    );
  }
  return (
    <>
      <section className="block" aria-labelledby="h-topics">
        <SectionHead num="02" id="h-topics" title="Topics to cover">
          The six themes covered by the most shows at the same time in the last 30 days. <strong>Ride it</strong>: several shows are on it now. <strong>Crowded</strong>: so widely covered that a fresh angle will stand out more than another take. Probability is the chance a new video on the topic beats its channel&apos;s typical views.
        </SectionHead>
        <ol className="topics">
          {topics.map((t) => {
            const on = t.simultaneous?.shows || 0;
            return (
              <li key={t.topic} className={`topic${st('topic', t.topic) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                <div className="t-rank mono" aria-hidden="true">{String(t.rank).padStart(2, '0')}</div>
                <div className="t-main">
                  <div className="t-head">
                    <h3>{t.topic}</h3>
                    <div className="badges">
                      {STANCE[t.stance] && <span className={`badge ${STANCE[t.stance][1]}`}>{STANCE[t.stance][0]}</span>}
                      {TREND[t.trend?.label] && <span className={`badge ${t.trend.label === 'cooling' ? '' : 'signal'}`}>{TREND[t.trend.label]}</span>}
                    </div>
                  </div>
                  <div className="t-viz">
                    <div className="coverage" role="img" aria-label={`Covered by ${on} of ${totalShows} shows in the last ${t.simultaneous?.days || 30} days`}>
                      {Array.from({ length: totalShows }, (_, i) => (
                        <i key={i} className={i < on ? 'on' : ''} data-dot />
                      ))}
                      <span className="mono">{on}/{totalShows} shows</span>
                    </div>
                    <div className="spark-wrap"><Sparkline values={t.weekly} label={`Episodes per week over the last four weeks: ${(t.weekly || []).join(', ')}`} /><span className="est">4 weeks</span></div>
                  </div>
                  <p className="why">{t.why}</p>
                  <Evidence items={t.evidence} />
                  {admin && <ReviewGate type="topic" name={t.topic} current={st('topic', t.topic)} />}
                </div>
                <div className="t-nums">
                  <div className="score"><span className="mono big" data-count={t.score.toFixed(1)} data-dec="1">{t.score.toFixed(1)}</span><span className="muted mono">/10 score</span></div>
                  <Prob value={t.probability} />
                </div>
              </li>
            );
          })}
        </ol>
        {results.notes.fewerTopics && <p className="note">Only {topics.length} topic{topics.length === 1 ? '' : 's'} had enough coverage in the data. We never pad the list with invented items.</p>}
      </section>
    </>
  );
}

function FounderCards({ items, admin, st }) {
  return (
    <ol className="founders">
            {items.map((g) => (
              <li key={g.guest} className={`fcard${g.mediaRound ? ' hot' : ''}${st('guest', g.guest) === 'dismissed' ? ' dismissed' : ''}`} data-card>
                <div className="f-top">
                  <div className="avatar" aria-hidden="true" style={{ background: `linear-gradient(135deg, hsl(${hueOf(g.guest)} 55% 38%), hsl(${(hueOf(g.guest) + 50) % 360} 60% 22%))` }}>{initials(g.guest)}</div>
                  <div className="f-id">
                    <span className="f-rank mono" aria-hidden="true">{String(g.rank).padStart(2, '0')}</span>
                    <h3>{g.guest}</h3>
                    <p className="f-role">{g.company ? <>{g.role === 'founder' ? 'Founder' : 'Guest'} at <span className="co">{g.company}</span></> : g.role === 'founder' ? 'Founder' : 'Guest'}</p>
                  </div>
                  <ProbRing value={g.probability} />
                </div>
                <div className="badges">
                  {g.mediaRound && <span className="badge amber">Media round</span>}
                  {g.fresh && <span className="badge signal">New voice</span>}
                  {g.saturated && <span className="badge">Heavily booked</span>}
                </div>
                <p className="why">{g.why}. Last seen {day(g.lastSeen)}.</p>
                <p className="shows-line"><span className="muted mono">On</span> {g.shows.map((n, i) => <span key={n}>{i > 0 && <span className="muted"> · </span>}<span className="show-n">{n}</span></span>)}</p>
                <Evidence items={g.evidence} />
                <FounderLinks search={searchLinks(g.guest, g.company)} />
                <span className="est">model estimate from the data</span>
                {admin && <ReviewGate type="guest" name={g.guest} current={st('guest', g.guest)} />}
              </li>
            ))}
          </ol>
  );
}

export function GuestsPanel({ results, admin, actions }) {
  const guests = results.guests || [];
  const st = (type, key) => actions[`${type}:${key}`] || '';
  const hotGuests = guests.filter((g) => g.mediaRound);
  return (
    <>
      <section className="block" aria-labelledby="h-guests">
        <SectionHead num="04" id="h-guests" title="Founders to track">
          Founders appearing across the shows, ranked on their own: no topic is involved, so whoever joins you, you can talk through the trending topics with them. A founder on two or more shows within the same month is on a <strong>media round</strong>: available, media-willing, and easiest to book now.
        </SectionHead>
        {results.excluded > 0 && <p className="note">{results.excluded} confirmed founder{results.excluded === 1 ? ' is' : 's are'} hidden from this list. You can put them back in Settings.</p>}
        {hotGuests.length > 0 ? (
          <div className="spotlight-banner" role="status"><span className="dot" aria-hidden="true" /><strong>{results.mediaRounds} founder{results.mediaRounds === 1 ? ' is' : 's are'} on a media round</strong> in the last 30 days. Reach them while the moment lasts.</div>
        ) : (
          guests.length > 0 && <div className="spotlight-banner quiet" role="status"><span className="dot amber" aria-hidden="true" /><span><strong>No founder is on a media round yet.</strong> Nobody has appeared on two or more of your monitored shows in the last 30 days. These are the strongest founders on a single show.</span></div>
        )}
        {admin && <FounderSummary initial={Object.fromEntries(Object.entries(actions).filter(([k]) => k.startsWith('guest:')).map(([k, v]) => [k.slice(6), v]))} />}
        {guests.length === 0 ? (
          <p className="note">No founders were found in the data. We never invent a person.</p>
        ) : (
          <FounderCards items={guests} admin={admin} st={st} />
        )}
        {guests.length > 0 && guests.length < 7 && <p className="note">Only {guests.length} founder{guests.length === 1 ? '' : 's'} could be found in the data. The list is never padded.</p>}
      </section>
    </>
  );
}

export function SponsorsPanel({ results, admin, actions, demo }) {
  const st = (type, key) => actions[`${type}:${key}`] || '';
  return (
    <>
      <section className="block" aria-labelledby="h-sponsors">
        <SectionHead num="05" id="h-sponsors" title="Sponsors to pitch">
          Brands promoted or mentioned across your shows: each appears on two or more shows or shows paid promotion. A founder naming their own company is not counted. <strong>Likely advertiser</strong> means the text showed paid promotion; <strong>Mentioned only</strong> means it was named without a paid signal. Spoken ad reads are not visible, so brand detection is partial.
        </SectionHead>
        {results.sponsors.length === 0 ? (
          <p className="note">No brands qualified in the last 90 days.</p>
        ) : (
          <ol className="sponsors">
            {results.sponsors.map((s) => {
              const sk = s.key || s.brand;
              return (
                <li key={sk} className={`srow${st('sponsor', sk) === 'dismissed' ? ' dismissed' : ''}`} data-row>
                  <div className="tile mono" aria-hidden="true">{s.brand[0]?.toUpperCase()}</div>
                  <div className="s-main">
                    <div className="t-head">
                      <h3>{s.brand}</h3>
                      <div className="badges"><span className={`badge ${s.likelyAdvertiser ? 'signal' : ''}`}>{s.likelyAdvertiser ? 'Likely advertiser' : 'Mentioned only'}</span></div>
                    </div>
                    <p className="why">{s.why}. Carried by: {s.shows.join(', ')}.</p>
                    <Evidence items={s.evidence} />
                    {admin && <ReviewGate type="sponsor" name={sk} label={s.brand} current={st('sponsor', sk)} />}
                  </div>
                  <div className="s-prob"><Prob value={s.probability} /></div>
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

export function TrendsPanel({ results }) {
  const tr = results.trends;
  const topics = (results.topics || []).filter((t) => t.weeklyShows).map((t) => ({ topic: t.topic, shows: t.simultaneous?.shows || 0, coverage: t.weeklyShows, interest: tr?.interest?.[t.topic] || null }));
  const coverageWeeks = tr?.showWeeks || topics[0]?.coverage.map((_, i, a) => (i === a.length - 1 ? 'now' : `-${a.length - 1 - i}w`)) || [];
  return (
    <section className="block">
      <SectionHead num="03" id="h-trends" title="Topic trends over time">
        The six topics compared week by week: how many of your shows covered each one (last 12 weeks), and how much the public is reading about it (Wikipedia page views over 16 weeks, a free live signal for hype). Click a topic name to hide or show its line; hover the chart to read a week.
      </SectionHead>
      {topics.length === 0 ? (
        <p className="note">Trend lines appear after the next data refresh.</p>
      ) : (
        <>
          <TrendChart coverageWeeks={coverageWeeks} interestWeeks={tr?.weeks || []} topics={topics} source={tr?.source} />
          {tr?.error && <p className="note">Some public-interest lines are missing this time ({tr.error}). They return on the next refresh.</p>}
          {!tr && <p className="note">Public-interest lines appear after the next data refresh.</p>}
        </>
      )}
    </section>
  );
}
