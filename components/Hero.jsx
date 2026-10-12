// Hero with a live radar: each of this week's topics is a blip. The more shows cover a topic at the same time, the closer it sits to the centre.
export function Hero({ topics = [], children }) {
  const list = topics.slice(0, 6);
  const counts = list.map((t) => t.simultaneous?.shows || 0);
  const lo = Math.min(...counts, 0);
  const hi = Math.max(...counts, 1);
  const blips = list.map((t, i) => {
    const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.45;
    // the more shows cover a topic right now, the nearer the centre; a small stagger keeps neighbours apart
    const hot = ((t.simultaneous?.shows || 0) - lo) / Math.max(hi - lo, 1);
    const r = 205 - hot * 105 - (i % 2) * 22;
    const x = 260 + Math.cos(angle) * r;
    const size = 5 + (t.score || 0) * 0.9;
    const left = x > 262; // labels on the right half open leftwards so they never leave the radar
    return { x, y: 260 + Math.sin(angle) * r, size, label: t.topic, rank: t.rank, stance: t.stance, left };
  });
  return (
    <div className="hero">
      <svg className="radar" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="sweepfill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c6f432" stopOpacity="0" />
            <stop offset="1" stopColor="#c6f432" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#c6f432" stopOpacity="0.18" />
            <stop offset="1" stopColor="#c6f432" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="260" cy="260" r="120" fill="url(#core)" stroke="none" />
        {[55, 105, 155, 205, 255].map((r) => (
          <circle key={r} className="ring" cx="260" cy="260" r={r} data-ring />
        ))}
        <line className="axis" x1="260" y1="5" x2="260" y2="515" />
        <line className="axis" x1="5" y1="260" x2="515" y2="260" />
        <g data-sweep>
          <g className="sweep">
            <path d="M260 260 L260 8 A252 252 0 0 1 395 42 Z" fill="url(#sweepfill)" stroke="none" />
            <line x1="260" y1="260" x2="260" y2="6" stroke="#c6f432" strokeWidth="1.5" opacity="0.85" />
          </g>
        </g>
        {blips.map((b) => (
          <g key={b.rank} className={`blip ${b.stance || ''}`} data-blip>
            <circle className="blip-ping" cx={b.x} cy={b.y} r={b.size + 6} />
            <circle className="blip-dot" cx={b.x} cy={b.y} r={b.size} />
            <text className="blip-rank" x={b.x} y={b.y + 3.5} textAnchor="middle">{b.rank}</text>
          </g>
        ))}
        <circle cx="260" cy="260" r="4" fill="#c6f432" />
      </svg>
      <div className="wrap hero-copy">
        <p className="eyebrow"><span className="dot" aria-hidden="true" /> Podcast Ecosystem Radar · weekly intelligence for Aditya</p>
        <h1 data-split>Catch the <em>moment</em> before it passes.</h1>
        {children}
      </div>
    </div>
  );
}
