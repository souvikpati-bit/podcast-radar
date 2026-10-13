'use client';
import { useEffect, useState } from 'react';

const TEXT = { shortlisted: '★ Shortlisted', contacted: 'Contacted', dismissed: 'Dismissed', sponsored: 'Sponsored' };

// A small tag on a card showing the choice Aditya made in the Review Gate. Stays in step with the buttons.
export function StatusTag({ type, name, initial }) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const onChange = (e) => {
      const d = e.detail || {};
      if (d.type === type && d.key === name) setStatus(d.status);
    };
    window.addEventListener('gate-change', onChange);
    return () => window.removeEventListener('gate-change', onChange);
  }, [type, name]);
  return TEXT[status] ? <span className={`badge st-${status}`}>{TEXT[status]}</span> : null;
}
