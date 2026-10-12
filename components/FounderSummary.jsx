'use client';
import { useEffect, useState } from 'react';

const TILES = [
  ['shortlisted', 'Shortlisted', 'Founders you want to approach'],
  ['contacted', 'Contacted outside the app', 'You have already messaged them'],
  ['booked', 'Confirmed', 'Agreed to come on; removed from the list'],
];

// Aditya's progress on the founder list. Updates the moment a Review Gate button is pressed (no reload needed).
export function FounderSummary({ initial }) {
  const [map, setMap] = useState(initial);

  useEffect(() => {
    const onChange = (e) => {
      const { type, key, status } = e.detail || {};
      if (type !== 'guest') return;
      setMap((m) => {
        const next = { ...m };
        if (status) next[key] = status;
        else delete next[key];
        return next;
      });
    };
    window.addEventListener('gate-change', onChange);
    return () => window.removeEventListener('gate-change', onChange);
  }, []);

  return (
    <div className="fsum" role="group" aria-label="Your progress with founders">
      {TILES.map(([status, label, note]) => {
        const names = Object.entries(map).filter(([, s]) => s === status).map(([n]) => n);
        return (
          <div className="fsum-t" key={status}>
            <span className="fsum-n mono" aria-live="polite">{names.length}</span>
            <span className="fsum-l">{label}</span>
            <span className="fsum-note">{names.length ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}` : note}</span>
          </div>
        );
      })}
    </div>
  );
}
