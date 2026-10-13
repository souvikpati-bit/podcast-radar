'use client';
import { useEffect, useMemo, useState } from 'react';
import { FounderLinks } from './FounderLinks';
import { shortlistItems, countItems, SHORTLIST_STATUSES } from '@/lib/shortlist-items';

const GROUPS = [
  ['topic', 'Topics to cover', 'Press Shortlist on a topic to plan an episode on it.'],
  ['guest', 'Guests to approach', 'Press Shortlist or Contacted on a guest to keep them here.'],
  ['sponsor', 'Sponsors to pitch', 'Press Shortlist or Contacted on a sponsor to keep it here.'],
];
const STATUS_TEXT = { shortlisted: '★ Shortlisted', contacted: 'Contacted' };

// Everything Aditya has marked, in one place. Updates live as buttons are pressed elsewhere on the page.
export function ShortlistPanel({ num, initial, details }) {
  const [marks, setMarks] = useState(initial);
  const [saving, setSaving] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const onChange = (e) => {
      const d = e.detail || {};
      if (!d.type) return;
      setMarks((m) => {
        const next = { ...m };
        const k = `${d.type}:${d.key}`;
        if (SHORTLIST_STATUSES.includes(d.status)) next[k] = d.status;
        else delete next[k];
        return next;
      });
    };
    window.addEventListener('gate-change', onChange);
    return () => window.removeEventListener('gate-change', onChange);
  }, []);

  const items = useMemo(() => shortlistItems(marks, details), [marks, details]);
  const total = countItems(items);

  async function remove(it) {
    if (saving) return;
    setSaving(`${it.type}:${it.key}`);
    setErr('');
    try {
      const res = await fetch('/api/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: it.type, key: it.key, status: 'clear' }) });
      if (res.ok) window.dispatchEvent(new CustomEvent('gate-change', { detail: { type: it.type, key: it.key, status: '' } }));
      else setErr((await res.json().catch(() => ({}))).error || 'Could not remove');
    } catch {
      setErr('Could not remove. Check your connection.');
    }
    setSaving('');
  }

  return (
    <section className="block" aria-labelledby="h-shortlist">
      <header className="sec-head">
        <span className="sec-num" aria-hidden="true">{num}</span>
        <h2 id="h-shortlist">Your shortlist</h2>
        <p className="sec-sub">Everything you marked <strong>Shortlist</strong> or <strong>Contacted</strong>. It also appears in your Monday email.</p>
      </header>
      <div className="fsum" role="group" aria-label="Shortlist totals">
        <div className="fsum-t"><span className="fsum-n mono">{items.topic.length}</span><span className="fsum-l">Topics</span><span className="fsum-note">episodes to make</span></div>
        <div className="fsum-t"><span className="fsum-n mono" style={{ color: 'var(--link)' }}>{items.guest.length}</span><span className="fsum-l">Guests</span><span className="fsum-note">people to approach</span></div>
        <div className="fsum-t"><span className="fsum-n mono" style={{ color: 'var(--mint)' }}>{items.sponsor.length}</span><span className="fsum-l">Sponsors</span><span className="fsum-note">brands to pitch</span></div>
      </div>
      <p style={{ margin: '4px 0 0' }}><a className="btn ghost" href="/api/actions/export">Download all marks (CSV)</a></p>
      {err && <p className="status-bad" role="alert">{err}</p>}
      {total === 0 && <p className="note">Nothing shortlisted yet. Press <strong>Shortlist</strong> on any topic, guest or sponsor and it will appear here.</p>}
      {GROUPS.map(([type, title, hint]) => (
        <div key={type} className="sl-group">
          <h3 className="tier-h">{title} <span className="tier-n mono">{items[type].length}</span></h3>
          {items[type].length === 0 ? <p className="muted" style={{ fontSize: 14 }}>{hint}</p> : (
            <ul className="sl">
              {items[type].map((it) => (
                <li key={`${it.type}:${it.key}`} className="sl-item">
                  <div className="sl-main">
                    <div className="sl-top">
                      <strong>{it.label}</strong>
                      <span className={`badge st-${it.status}`}>{STATUS_TEXT[it.status]}</span>
                    </div>
                    {it.sub && <p className="muted" style={{ fontSize: 13 }}>{it.sub}</p>}
                    {it.links && <FounderLinks search={it.links} />}
                  </div>
                  <button type="button" className="btn ghost" disabled={Boolean(saving)} onClick={() => remove(it)} aria-label={`Remove ${it.label} from the shortlist`}>{saving === `${it.type}:${it.key}` ? 'Removing…' : 'Remove'}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
