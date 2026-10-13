import { createHash } from 'node:crypto';
import Link from 'next/link';
import { getEnv } from '@/lib/env';
import { orderTopics } from '@/lib/scoring';
import { ShortlistPanel } from '@/components/ShortlistPanel';
import { shortlistDetails, SHORTLIST_STATUSES } from '@/lib/shortlist';
import { getDashboardData } from '@/lib/snapshot';
import { actionMap } from '@/lib/actions';
import { isAdminPage } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Hero } from '@/components/Hero';
import { Banner } from '@/components/Banner';
import { TopicsPanel, GuestsPanel, SponsorsPanel } from '@/components/Dashboard';
import { BlockTabs } from '@/components/BlockTabs';
import { LoginPanel } from '@/components/LoginPanel';
import { Method } from '@/components/Method';
import { MotionRoot } from '@/components/MotionRoot';
import { ChannelManager } from '@/components/ChannelManager';
import { listChannels } from '@/lib/channels';
import cfg from '@/config/pipeline.json';

export const dynamic = 'force-dynamic';

// When SHOW_SPONSOR_NAMES is false the brand names never leave the server.
function maskSponsors(results) {
  return {
    ...results,
    sponsors: results.sponsors.map((s) => ({
      ...s,
      key: createHash('sha1').update(s.brand).digest('hex').slice(0, 10),
      brand: `Sponsor ${s.rank}`,
      evidence: s.evidence.map((e) => ({ ...e, title: 'Video that mentions this brand' })),
    })),
  };
}

export default async function Home() {
  const [data, admin] = await Promise.all([getDashboardData(), isAdminPage()]);
  const actions = admin ? await actionMap() : {};
  const chans = await listChannels();
  const n = chans.rows?.length || 0;
  const env = getEnv();
  const shown = env.showSponsorNames ? data.snapshot.results : maskSponsors(data.snapshot.results);
  const results = { ...shown, topics: orderTopics(shown.topics) };
  return (
    <MotionRoot>
      <TopBar admin={admin} active="home" />
      <main id="main">
        <Hero topics={results.topics}>
          <Banner data={data} />
        </Hero>
        <BlockTabs
          label="Dashboard sections"
          initial="topics"
          tabs={[
            { id: 'login', num: '01', label: admin ? 'Logged in' : 'Login', hint: admin ? 'Aditya · manage shows' : 'Aditya only', content: <LoginPanel admin={admin} /> },
            { id: 'topics', num: '02', label: 'Topics', hint: `${results.topics.length} to cover`, content: <TopicsPanel results={results} admin={admin} actions={actions} /> },
            { id: 'guests', num: '03', label: 'Founders', hint: `${(results.guests || []).length} to track${results.mediaRounds ? ` · ${results.mediaRounds} on a media round` : ''}`, content: <GuestsPanel results={results} admin={admin} actions={actions} /> },
            { id: 'sponsors', num: '04', label: 'Sponsors', hint: `${results.sponsors.length} to pitch`, content: <SponsorsPanel results={results} admin={admin} actions={actions} demo={data.kind === 'demo'} /> },
            { id: 'shows', num: '05', label: 'Shows', hint: `${n} of ${cfg.maxChannels} tracked · add or remove`, content: (
              <section className="block" aria-labelledby="h-shows">
            <header className="sec-head">
              <span className="sec-num" aria-hidden="true">05</span>
              <h2 id="h-shows">Shows we track ({n}/{cfg.maxChannels})</h2>
              <p className="sec-sub">The podcasts this radar watches. Add or remove up to {cfg.maxChannels}, no code needed.</p>
            </header>
            <ChannelManager channels={chans.rows || []} maxChannels={cfg.maxChannels} admin={admin} dbError={chans.ok ? '' : chans.error} />
          </section>
            ) },
            ...(admin ? [{ id: 'shortlist', num: '06', label: 'Your shortlist', hint: 'Topics, founders, sponsors you marked', content: <ShortlistPanel num="06" initial={Object.fromEntries(Object.entries(actions).filter(([, v]) => SHORTLIST_STATUSES.includes(v)))} details={shortlistDetails(data.snapshot.results, env.showSponsorNames)} /> }] : []),
            { id: 'method', num: admin ? '07' : '06', label: 'How it works', hint: 'Every number explained', content: <Method num={admin ? '07' : '06'} /> },
          ]}
        />
      </main>
      <footer>
        <div className="wrap">
          <p>Data: public YouTube metadata for the monitored shows. Every probability is a model estimate from the data, not a guarantee. This tool never contacts a guest or a sponsor. <Link href="/briefs">Past briefs</Link></p>
        </div>
      </footer>
    </MotionRoot>
  );
}
