import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeQuery } from '@/lib/db';
import { isAdminPage } from '@/lib/session';
import { TopBar } from '@/components/TopBar';

export const dynamic = 'force-dynamic';

export default async function BriefPage({ params }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const [admin, r] = await Promise.all([isAdminPage(), safeQuery('SELECT html, status, error FROM briefs WHERE week_start = $1', [date])]);
  if (!r.ok || !r.rows[0]) notFound();
  const b = r.rows[0];
  return (
    <>
      <TopBar admin={admin} active="briefs" />
      <main id="main" className="wrap" style={{ paddingTop: 32 }}>
        <p className="muted mono" style={{ fontSize: 13 }}><Link href="/briefs">← All briefs</Link> · week of {date} · {b.status}</p>
        {b.error && <p className="note">Delivery problem: {b.error}</p>}
        {/* The stored HTML is shown in a sandboxed frame so it looks exactly as emailed and cannot run scripts. */}
        <iframe title={`Brief for week of ${date}`} sandbox="" srcDoc={b.html || '<p>Empty</p>'} style={{ width: '100%', height: '80vh', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', marginTop: 16 }} />
      </main>
    </>
  );
}
