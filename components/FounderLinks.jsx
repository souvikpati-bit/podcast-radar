'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NAMES = { linkedin: 'LinkedIn', x: 'X', instagram: 'Instagram' };

// Reach-out links for one founder. Saved links are real (pasted by Aditya). The search buttons are searches, not guesses.
export function FounderLinks({ guest, search, saved = {}, admin }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(body) {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guest, ...body }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || 'Could not save');
      return;
    }
    setUrl('');
    router.refresh();
  }

  const open = (href, label, cls = 'chip') => <a key={label} className={cls} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
  const missing = ['linkedin', 'x', 'instagram'].filter((n) => !saved[n]);

  return (
    <div className="reach">
      {Object.keys(NAMES).some((n) => saved[n]) && (
        <div className="reach-row">
          <span className="reach-l mono">Profile</span>
          {Object.keys(NAMES).filter((n) => saved[n]).map((n) => (
            <span key={n} className="saved-chip">
              {open(saved[n], `${NAMES[n]} ↗`, 'saved-a')}
              {admin && <button type="button" className="x-btn" aria-label={`Remove saved ${NAMES[n]} link for ${guest}`} disabled={busy} onClick={() => call({ action: 'remove', network: n })}>×</button>}
            </span>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="reach-row">
          <span className="reach-l mono">Find</span>
          {missing.map((n) => open(search[n], `${NAMES[n]} search ↗`))}
          {open(search.google, 'Google ↗')}
        </div>
      )}
      {admin && (
        <form className="reach-form" onSubmit={(e) => { e.preventDefault(); call({ url }); }}>
          <label htmlFor={`pl-${guest}`} className="sr-only">Paste a profile link for {guest}</label>
          <input id={`pl-${guest}`} type="url" inputMode="url" placeholder="Found them? Paste their LinkedIn / X / Instagram link once" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} required />
          <button className="btn ghost" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      )}
      {msg && <p className="status-bad" role="alert" style={{ fontSize: 13, marginTop: 6 }}>{msg}</p>}
    </div>
  );
}
