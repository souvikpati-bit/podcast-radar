'use client';
import { useState } from 'react';

const OPTIONS = {
  topic: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss']],
  guest: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss'], ['contacted', 'Contacted outside app'], ['booked', 'Booked']],
  sponsor: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss'], ['contacted', 'Contacted outside app'], ['sponsored', 'Sponsored']],
};

// Aditya's private notebook. Nothing here contacts anyone.
export function ReviewGate({ type, name, label, current }) {
  const [status, setStatus] = useState(current);
  const [err, setErr] = useState('');
  async function choose(next) {
    const value = status === next ? 'clear' : next;
    setErr('');
    const res = await fetch('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, key: name, status: value }) });
    if (res.ok) setStatus(value === 'clear' ? '' : value);
    else setErr((await res.json().catch(() => ({}))).error || 'Could not save');
  }
  return (
    <div className="gate" role="group" aria-label={`Review ${label || name}`}>
      {OPTIONS[type].map(([key, label]) => (
        <button key={key} type="button" aria-pressed={status === key} onClick={() => choose(key)}>{label}</button>
      ))}
      {err && <span className="status-bad mono" role="alert">{err}</span>}
    </div>
  );
}
