import Link from 'next/link';
import { BackButton } from './BackButton';

export function TopBar({ admin, active, backHref }) {
  // Sub-pages go back to their parent; the dashboard steps back through the blocks you opened.
  const to = backHref !== undefined ? backHref : active === 'home' ? null : '/';
  const toLabel = to === '/briefs' ? 'All briefs' : 'Dashboard';
  return (
    <header className="topbar" data-topbar>
      <div className="wrap">
        <div className="tb-left">
          <Link className="brand" href="/" aria-label="Podcast Ecosystem Radar home"><span className="dot" aria-hidden="true" />Radar</Link>
          <BackButton href={to || undefined} label={toLabel} />
        </div>
        <nav className="nav" aria-label="Main">
          <Link className="sec" href="/#shows">Shows</Link>
          <Link className="sec" href="/#topics" aria-current={active === 'home' ? 'page' : undefined}>Topics</Link>
          <Link className="sec" href="/#guests">Guests</Link>
          <Link className="sec" href="/#sponsors">Sponsors</Link>
          <Link href="/briefs" aria-current={active === 'briefs' ? 'page' : undefined}>Briefs</Link>
          <Link href="/settings" aria-current={active === 'settings' ? 'page' : undefined}>{admin ? 'Settings' : 'Login'}</Link>
        </nav>
      </div>
      <div className="rail" aria-hidden="true"><i data-progress /></div>
    </header>
  );
}
