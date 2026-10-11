import Link from 'next/link';
import { TopBar } from '@/components/TopBar';

export const metadata = { title: 'Not found · Podcast Ecosystem Radar' };

export default function NotFound() {
  return (
    <>
      <TopBar admin={false} />
      <main id="main" className="wrap">
        <div className="empty" style={{ paddingTop: 96 }}>
          <h2>Signal lost</h2>
          <p>That page is not on the radar.</p>
          <p style={{ marginTop: 20 }}><Link className="btn" href="/">Back to the dashboard</Link></p>
        </div>
      </main>
    </>
  );
}
