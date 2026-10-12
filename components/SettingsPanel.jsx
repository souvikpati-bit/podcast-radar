'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIST } from '@/lib/format';
import { gsap, useGSAP } from '@/lib/gsap';
import { ChannelManager } from './ChannelManager';
import { BlockTabs } from './BlockTabs';

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function SettingsPanel({ channels, dbError, health, missing, impact, confirmed = [], emailReady, maxChannels }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);

  useGSAP(() => {
    if (msg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.from('[data-toast]', { y: 24, opacity: 0, duration: 0.4, ease: 'power3.out' });
  }, { dependencies: [msg] });

  const toast = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 6000);
  };

  async function refreshNow() {
    setBusy('refresh');
    let state = null;
    setProgress({ pct: 2, label: 'Starting' });
    for (let i = 0; i < 80; i++) {
      const r = await post('/api/refresh', { state });
      if (!r.ok) {
        toast(r.data.error || 'Refresh failed');
        break;
      }
      setProgress(r.data.progress);
      if (r.data.done) {
        toast(r.data.error ? `Refresh stopped: ${r.data.error}` : r.data.progress.label);
        break;
      }
      state = r.data.state;
    }
    setBusy('');
    setProgress(null);
    router.refresh();
  }
  async function sendBrief(force) {
    if (force && !window.confirm('Send this week’s brief again?')) return;
    setBusy('brief');
    const r = await post('/api/brief/send', { force });
    setBusy('');
    toast(r.ok ? r.data.message : r.data.error || 'Could not send');
    router.refresh();
  }
  async function putBack(name) {
    const r = await post('/api/actions', { type: 'guest', key: name, status: 'clear' });
    toast(r.ok ? `${name} is back on the list` : r.data.error || 'Could not save');
    router.refresh();
  }
  async function logout() {
    await post('/api/logout');
    router.refresh();
  }

  return (
    <div>
      <div className="sec-head"><span className="sec-num">S</span><h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 'clamp(34px,7vw,56px)' }}>Settings</h1></div>
      <p className="sec-sub">Everything here is private to Aditya. Monitored shows, data refresh, the Monday brief and system health.</p>

      <BlockTabs
        bare
        label="Settings sections"
        tabs={[
          { id: 'actions', label: 'Actions', hint: 'Refresh data · send the brief', content: (
            <>
          <div className="card">
            <h2 style={{ fontSize: 18 }}>Actions</h2>
            <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn" onClick={refreshNow} disabled={Boolean(busy)}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh data now'}</button>
              <button className="btn ghost" onClick={() => sendBrief(false)} disabled={Boolean(busy)}>{busy === 'brief' ? 'Sending…' : 'Send brief now'}</button>
              <button className="btn ghost" onClick={() => sendBrief(true)} disabled={Boolean(busy)}>Resend brief</button>
              <a className="btn ghost" href="/api/actions/export">Download Review Gate CSV</a>
              <button className="btn ghost" onClick={logout}>Log out</button>
            </p>
            {progress && (
              <div role="status" aria-live="polite">
                <div className="progress"><i style={{ transform: `scaleX(${(progress.pct || 0) / 100})` }} /></div>
                <p className="muted mono" style={{ fontSize: 13, marginTop: 6 }}>{progress.label}</p>
              </div>
            )}
            {!emailReady && <p className="note">Email is not ready: set RESEND_API_KEY and BRIEF_TO_EMAIL, then redeploy. &ldquo;Send brief now&rdquo; will explain what is missing.</p>}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 18 }}>Impact (from the Review Gate)</h2>
            <p style={{ marginTop: 8 }}><span className="mono" style={{ fontSize: 28, color: 'var(--signal)' }}>{impact.guestsBooked}</span> guests booked · <span className="mono" style={{ fontSize: 28, color: 'var(--signal)' }}>{impact.sponsorsWon}</span> sponsors won</p>
          </div>

            </>
          ) },
          { id: 'shows', label: 'Shows', hint: `${channels.length} of ${maxChannels} tracked · add or remove`, content: (
            <>
          <div className="card">
            <h2 style={{ fontSize: 18 }}>Monitored channels ({channels.length}/{maxChannels})</h2>
            <ChannelManager channels={channels} maxChannels={maxChannels} admin dbError={dbError} />
          </div>

            </>
          ) },
          { id: 'guests', label: 'Confirmed guests', hint: `${confirmed.length} hidden from the list`, content: (
            <>
          <div className="card">
            <h2 style={{ fontSize: 18 }}>Confirmed guests (hidden from the list)</h2>
            {confirmed.length === 0 ? <p className="muted" style={{ marginTop: 8 }}>None. Guests stay on the list until you confirm them with the Review Gate button.</p> : (
              <ul style={{ paddingLeft: 0, listStyle: 'none' }}>{confirmed.map((g) => <li key={g} className="chan"><span className="grow">{g}</span><button className="btn ghost" onClick={() => putBack(g)}>Put back on the list</button></li>)}</ul>
            )}
          </div>

            </>
          ) },
          { id: 'health', label: 'System health', hint: 'Quota, keys, runs', content: (
            <>
          <div className="card">
            <h2 style={{ fontSize: 18 }}>System health</h2>
            {!health.dbOk && <p className="note">Database not connected ({health.dbError}). The dashboard is showing demo data.</p>}
            <p style={{ marginTop: 8 }}>
              YouTube units today: <span className={`mono ${health.unitAlert ? 'status-warn' : ''}`}>{health.today.units}/{health.unitBudget}</span>
              {health.unitAlert && <span className="status-warn"> (above 80: slow down)</span>} · Gemini calls today: <span className="mono">{health.today.gemini}</span> · Emails today: <span className="mono">{health.today.emails}</span>
            </p>
            <p className="muted" style={{ fontSize: 13 }}>Running cost: all inside free tiers (YouTube 10,000 units/day, Gemini Flash free tier, Resend 100 emails/day).</p>
            <h3 style={{ fontSize: 15, marginTop: 16 }}>Missing keys</h3>
            {missing.length === 0 ? <p className="status-ok">All keys are set.</p> : (
              <ul>{missing.map((m) => <li key={m.name}><span className="mono status-warn">{m.name}</span>: {m.effect}</li>)}</ul>
            )}
            <h3 style={{ fontSize: 15, marginTop: 16 }}>Automatic reinforcement (last refresh)</h3>
            {(health.notes || []).length === 0 ? <p className="muted">Data was not thin, so nothing needed adding.</p> : (
              <ul>{health.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            )}
            <h3 style={{ fontSize: 15, marginTop: 16 }}>Channels that failed last refresh</h3>
            {health.failedChannels.length === 0 ? <p className="muted">None.</p> : (
              <ul>{health.failedChannels.map((f, i) => <li key={i}><strong>{f.channel}</strong>: {f.reason}</li>)}</ul>
            )}
            <h3 style={{ fontSize: 15, marginTop: 16 }}>Last brief</h3>
            <p>{health.lastBrief ? `Week of ${String(health.lastBrief.week_start).slice(0, 10)}: ${health.lastBrief.status}${health.lastBrief.error ? ` (${health.lastBrief.error})` : ''}` : 'No brief yet.'}</p>
            <h3 style={{ fontSize: 15, marginTop: 16 }}>Recent runs</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="t">
                <thead><tr><th>When (IST)</th><th>Kind</th><th>Status</th><th>Units</th><th>Videos</th><th>Gemini</th></tr></thead>
                <tbody>
                  {health.runs.map((r) => (
                    <tr key={r.id}><td>{formatIST(r.started_at)}</td><td>{r.kind}</td><td>{r.status}</td><td className="mono">{r.units_used}</td><td className="mono">{r.videos_fetched}</td><td className="mono">{r.gemini_calls}</td></tr>
                  ))}
                  {health.runs.length === 0 && <tr><td colSpan="6" className="muted">No runs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
            </>
          ) },
        ]}
      />
      {msg && <div className="toast" role="status" data-toast>{msg}</div>}
    </div>
  );
}
