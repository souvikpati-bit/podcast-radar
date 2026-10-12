// A slow ticker of the monitored shows. CSS-only motion; the second copy is hidden from screen readers.
export function Marquee({ shows = [] }) {
  const names = [...new Set(shows)].filter(Boolean);
  if (!names.length) return null;
  const row = (hidden) => (
    <ul className="marquee-row" aria-hidden={hidden || undefined} aria-label={hidden ? undefined : 'Monitored shows'}>
      {names.map((n) => (
        <li key={n}><span className="dot" aria-hidden="true" />{n}</li>
      ))}
    </ul>
  );
  return (
    <div className="marquee" role="region" aria-label="Monitored shows">
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
