import Link from 'next/link';
import { safeQuery } from '@/lib/db';
import { formatIST } from '@/lib/format';
import { isAdminPage } from '@/lib/session';
import { TopBar } from '@/components/TopBar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Past briefs · Podcast Ecosystem Radar' };

export default async function Briefs() {
  const [admin, r] = await Promise.all([isAdminPage(), safeQuery('SELECT week_start, status, sent_at, error FROM briefs ORDER BY week_start DESC LIMIT 60')]);
  return (
    <>
      <TopBar admin={admin} active="briefs" />
      <main id="main" className="wrap" style={{ paddingTop: 48 }}>
        <div className="sec-head"><span className="sec-num">H</span><h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 'clamp(34px,7vw,56px)' }}>Past briefs</h1></div>
        <p className="sec-sub">Every Monday brief, exactly as it was emailed.</p>
        {!r.ok && <p className="note">The archive needs the database ({r.error}).</p>}
        {r.ok && r.rows.length === 0 && (
          <div className="empty"><h2>No briefs yet</h2><p>The first one is sent on Monday morning, or from Settings with &ldquo;Send brief now&rdquo;.</p></div>
        )}
        <ul className="rows">
          {r.rows.map((b) => {
            const d = new Date(b.week_start).toISOString().slice(0, 10);
            return (
              <li key={d} className="row" style={{ gridTemplateColumns: '1fr' }}>
                <h3 className="row-title"><Link href={`/briefs/${d}`}>Week of {d}</Link> <span className={`badge ${b.status === 'sent' ? 'signal' : b.status === 'failed' ? 'amber' : ''}`}>{b.status}</span></h3>
                <p className="why">{b.status === 'sent' && b.sent_at ? `Sent ${formatIST(b.sent_at)}` : b.error ? `Not sent: ${b.error}` : 'Draft'}</p>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
