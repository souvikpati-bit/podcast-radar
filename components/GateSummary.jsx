'use client';
import { useEffect, useState } from 'react';

// Aditya's progress on a list (topics or founders). Updates the moment a Review Gate button is pressed, no reload needed.
// tiles: [[status, title, hint], ...]
export function GateSummary({ type, initial, tiles, label, variant = '' }) {
  const [map, setMap] = useState(initial);

  useEffect(() => {
    const onChange = (e) => {
      const d = e.detail || {};
      if (d.type !== type) return;
      setMap((m) => {
        const next = { ...m };
        if (d.status) next[d.key] = d.status;
        else delete next[d.key];
        return next;
      });
    };
    window.addEventListener('gate-change', onChange);
    return () => window.removeEventListener('gate-change', onChange);
  }, [type]);

  return (
    <div className={`fsum ${variant}`} role="group" aria-label={label}>
      {tiles.map(([status, title, hint]) => {
        const names = Object.entries(map).filter(([, s]) => s === status).map(([n]) => n);
        return (
          <div className="fsum-t" key={status}>
            <span className="fsum-n mono" aria-live="polite">{names.length}</span>
            <span className="fsum-l">{title}</span>
            <span className="fsum-note">{names.length ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}` : hint}</span>
          </div>
        );
      })}
    </div>
  );
}
