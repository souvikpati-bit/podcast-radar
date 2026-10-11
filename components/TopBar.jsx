import Link from 'next/link';

export function TopBar({ admin, active }) {
  return (
    <header className="topbar" data-topbar>
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Podcast Ecosystem Radar home"><span className="dot" aria-hidden="true" />Radar</Link>
        <nav className="nav" aria-label="Main">
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
