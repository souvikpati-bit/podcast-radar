// "This week at a glance": three big numbers that answer the three questions in the brief.
export function StatStrip({ results }) {
  const hot = results.topics.filter((t) => (t.simultaneous?.shows || 0) >= 3).length;
  const stats = [
    { n: hot, label: 'Topics on 3+ shows now', note: 'covered at the same time' },
    { n: results.counts.channels, label: 'Shows monitored', note: 'configurable in Settings' },
    { n: results.counts.videos, label: 'Guest episodes read', note: 'last 60 days' },
  ];
  return (
    <section className="stats wrap" aria-label="This week at a glance">
      <ul>
        {stats.map((s) => (
          <li key={s.label} className={`stat${s.accent ? ' accent' : ''}`} data-stat>
            <span className="stat-n mono" data-count={s.n} data-dec="0">{s.n}</span>
            <span className="stat-label">{s.label}</span>
            <span className="stat-note">{s.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
