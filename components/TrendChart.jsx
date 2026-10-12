'use client';
import { useMemo, useState } from 'react';

const COLORS = ['#c6f432', '#ffb547', '#6ec1ff', '#ff7a6b', '#b79bdc', '#7ee0c0'];
const W = 760;
const H = 330;
const M = { l: 44, r: 18, t: 16, b: 36 };

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// Public interest is shown as an index: 100 = that topic's own average over the eight weeks, so topics of very different size can be compared.
const toIndex = (vals) => {
  const base = avg(vals.filter((v) => v > 0));
  return base ? vals.map((v) => Math.round((v / base) * 100)) : vals.map(() => 0);
};
const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export function TrendChart({ weeks, topics, source }) {
  const hasInterest = topics.some((t) => t.interest);
  const [mode, setMode] = useState('episodes');
  const [off, setOff] = useState({});
  const [hover, setHover] = useState(null);
  const active = hasInterest ? mode : 'episodes';

  const series = useMemo(
    () => topics.map((t, i) => ({ ...t, color: COLORS[i % COLORS.length], values: active === 'interest' ? (t.interest ? toIndex(t.interest) : null) : t.episodes })),
    [topics, active],
  );
  const shown = series.filter((s) => s.values && !off[s.topic]);
  const n = weeks.length;
  const max = Math.max(1, ...shown.flatMap((s) => s.values)) * 1.12;
  const x = (i) => M.l + (i * (W - M.l - M.r)) / Math.max(n - 1, 1);
  const y = (v) => M.t + (1 - v / max) * (H - M.t - M.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1)))));
  };
  const at = hover === null ? n - 1 : hover;

  return (
    <div className="trend">
      {hasInterest && (
        <div className="seg" role="group" aria-label="What the chart shows">
          <button type="button" aria-pressed={active === 'episodes'} onClick={() => setMode('episodes')}>Episodes per week</button>
          <button type="button" aria-pressed={active === 'interest'} onClick={() => setMode('interest')}>Public interest</button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 14, margin: '10px 0 6px' }}>
        {active === 'interest'
          ? `${source || 'Wikipedia page views'}, shown as an index: 100 = that topic's own average over the eight weeks. Above 100 means more people are reading about it than usual.`
          : 'Guest episodes on each topic, per week, across all monitored shows.'}
      </p>
      <div className="legend" role="group" aria-label="Topics on the chart">
        {series.map((s) => (
          <button key={s.topic} type="button" className="lg" aria-pressed={!off[s.topic]} disabled={!s.values} onClick={() => setOff((o) => ({ ...o, [s.topic]: !o[s.topic] }))} title={s.values ? 'Click to hide or show' : 'No data for this topic'}>
            <i style={{ background: s.color }} />{s.topic}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label={`Line chart comparing ${shown.length} topics over the last ${n} weeks`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="axis-t">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => (i % 2 === 0 || i === n - 1) && <text key={w + i} x={x(i)} y={H - 12} textAnchor="middle" className="axis-t">{w}</text>)}
        {hover !== null && <line x1={x(at)} x2={x(at)} y1={M.t} y2={H - M.b} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />}
        {shown.map((s) => (
          <g key={s.topic}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            <circle cx={x(at)} cy={y(s.values[at])} r="4" fill={s.color} />
          </g>
        ))}
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="transparent" />
      </svg>
      <p className="readout mono" aria-live="polite">
        <strong>Week of {weeks[at]}</strong>
        {shown.map((s) => <span key={s.topic}><i style={{ background: s.color }} />{s.topic}: {s.values[at]}</span>)}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Topic</th><th>Shows now</th><th>Episodes, last 2 weeks vs 2 before</th>{hasInterest && <th>Public interest, latest week vs 8-week average</th>}</tr></thead>
          <tbody>
            {topics.map((t) => {
              const e = t.episodes;
              const recent = e.slice(-2).reduce((a, b) => a + b, 0);
              const before = e.slice(-4, -2).reduce((a, b) => a + b, 0);
              const d = pctChange(recent, before);
              const idx = t.interest ? toIndex(t.interest) : null;
              const last = idx ? idx[idx.length - 1] - 100 : null;
              return (
                <tr key={t.topic}>
                  <td>{t.topic}</td>
                  <td className="mono">{t.shows}</td>
                  <td className="mono">{recent} vs {before}{d === null ? '' : ` (${d > 0 ? '+' : ''}${d}%)`}</td>
                  {hasInterest && <td className="mono">{last === null ? 'no data' : `${last > 0 ? '+' : ''}${last}%`}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
