'use client';
import { useState } from 'react';

const OPTIONS = {
  topic: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss']],
  guest: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss'], ['contacted', 'Contacted outside app'], ['booked', 'Confirmed: remove from list']],
  sponsor: [['shortlisted', 'Shortlist'], ['dismissed', 'Dismiss'], ['contacted', 'Contacted outside app'], ['sponsored', 'Sponsored']],
};

// Aditya's private notebook. Nothing here contacts anyone.
export function ReviewGate({ type, name, label, current }) {
  const [status, setStatus] = useState(current);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  async function choose(next) {
    if (saving) return; // a second click while a save is running would send the wrong choice
    const value = status === next ? 'clear' : next;
    setErr('');
    setSaving(true);
    try {
      const res = await fetch('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, key: name, status: value }) });
      if (res.ok) {
        const shown = value === 'clear' ? '' : value;
        setStatus(shown);
        window.dispatchEvent(new CustomEvent('gate-change', { detail: { type, key: name, status: shown } }));
      } else setErr((await res.json().catch(() => ({}))).error || 'Could not save');
    } catch {
      setErr('Could not save. Check your connection.');
    }
    setSaving(false);
  }
  return (
    <div className="gate" role="group" aria-label={`Review ${label || name}`} aria-busy={saving}>
      {OPTIONS[type].map(([key, text]) => (
        <button key={key} type="button" aria-pressed={status === key} disabled={saving} onClick={() => choose(key)}>{text}</button>
      ))}
      {saving && <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }} role="status">Saving…</span>}
      {err && <span className="status-bad mono" role="alert">{err}</span>}
    </div>
  );
}
