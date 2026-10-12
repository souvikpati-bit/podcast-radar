// Four-week mini chart of how many guest episodes covered a topic each week (oldest to newest).
export function Sparkline({ values = [], label }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const w = 72;
  const h = 26;
  const pts = values.map((v, i) => [4 + (i * (w - 8)) / Math.max(values.length - 1, 1), h - 4 - (v / max) * (h - 8)]);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label || `Episodes per week: ${values.join(', ')}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" data-spark />
      <circle cx={last[0]} cy={last[1]} r="2.6" />
    </svg>
  );
}
