import Link from 'next/link';
import { getEnv } from '@/lib/env';
import { getDashboardData } from '@/lib/snapshot';
import { actionMap } from '@/lib/actions';
import { isAdminPage } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { Hero } from '@/components/Hero';
import { Banner } from '@/components/Banner';
import { Dashboard } from '@/components/Dashboard';
import { Method } from '@/components/Method';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [data, admin] = await Promise.all([getDashboardData(), isAdminPage()]);
  const actions = admin ? await actionMap() : {};
  const env = getEnv();
  return (
    <>
      <TopBar admin={admin} active="home" />
      <main id="main">
        <Hero>
          <Banner data={data} />
        </Hero>
        <div className="wrap">
          <Dashboard results={data.snapshot.results} showSponsorNames={env.showSponsorNames} admin={admin} actions={actions} demo={data.kind === 'demo'} />
          <Method />
        </div>
      </main>
      <footer>
        <div className="wrap">
          <p>Data: public YouTube metadata for the monitored shows. Every probability is a model estimate from the data, not a guarantee. This tool never contacts a guest or a sponsor. <Link href="/briefs">Past briefs</Link></p>
        </div>
      </footer>
    </>
  );
}
