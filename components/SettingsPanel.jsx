'use client';
/* eslint-disable @next/next/no-img-element -- channel thumbnails come from YouTube and are tiny */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIST } from '@/lib/format';
import { gsap, useGSAP } from '@/lib/gsap';

// A podcast RSS feed link (anything http(s) that is not a YouTube address).
const isFeed = (s) => /^https?:\/\//i.test(s.trim()) && !/youtube\.com|youtu\.be/i.test(s);

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function SettingsPanel({ channels, dbError, health, missing, impact, confirmed = [], emailReady, maxChannels }) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [host, setHost] = useState('');
  const [preview, setPreview] = useState(null);
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

  async function doPreview(e) {
    e.preventDefault();
    setBusy('preview');
    setPreview(null);
    const r = await post('/api/channels', { action: isFeed(input) ? 'preview-feed' : 'preview', input });
    setBusy('');
    if (r.ok) setPreview(r.data.channel);
    else toast(r.data.error || 'Could not check that channel');
  }
  async function confirmAdd() {
    setBusy('add');
    const r = await post('/api/channels', { action: isFeed(input) ? 'add-feed' : 'add', input, host });
    setBusy('');
    if (r.ok) {
      setInput('');
      setHost('');
      setPreview(null);
      toast(`Added ${r.data.channel.title}`);
      router.refresh();
    } else toast(r.data.error || 'Could not add');
  }
  async function remove(c) {
    if (!window.confirm(`Remove ${c.title || c.handle}? Its videos are removed from the dashboard.`)) return;
    const r = await post('/api/channels', { action: 'remove', id: c.id });
    if (r.ok) router.refresh();
    else toast(r.data.error || 'Could not remove');
  }
  async function saveHost(c, value) {
    const r = await post('/api/channels', { action: 'host', id: c.id, host: value });
    toast(r.ok ? 'Host saved' : r.data.error || 'Could not save');
  }
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

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Confirmed guests (hidden from the list)</h2>
        {confirmed.length === 0 ? <p className="muted" style={{ marginTop: 8 }}>None. Guests stay on the list until you confirm them with the Review Gate button.</p> : (
          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>{confirmed.map((g) => <li key={g} className="chan"><span className="grow">{g}</span><button className="btn ghost" onClick={() => putBack(g)}>Put back on the list</button></li>)}</ul>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Monitored channels ({channels.length}/{maxChannels})</h2>
        {dbError && <p className="note">Database not available: {dbError}. Channels cannot be saved until DATABASE_URL is set.</p>}
        {channels.length === 0 && !dbError && <p className="muted" style={{ marginTop: 8 }}>No channels yet. The default list is added on the first refresh, or add your own below.</p>}
        {channels.map((c) => (
          <div className="chan" key={c.id}>
            {c.thumbnail ? <img src={c.thumbnail} alt="" width="40" height="40" /> : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--line)' }} />}
            <div className="grow"><strong>{c.title || c.handle}</strong><div className="muted mono" style={{ fontSize: 12 }}>{c.feed_url ? 'RSS feed (no YouTube quota)' : c.handle}</div></div>
            <div>
              <label htmlFor={`host-${c.id}`} style={{ margin: 0 }}>Host</label>
              <input id={`host-${c.id}`} type="text" defaultValue={c.host_name || ''} maxLength={80} placeholder="Host name" onBlur={(e) => e.target.value !== (c.host_name || '') && saveHost(c, e.target.value)} />
            </div>
            <button className="btn ghost" onClick={() => remove(c)} aria-label={`Remove ${c.title || c.handle}`}>Remove</button>
          </div>
        ))}
        <form onSubmit={doPreview} style={{ marginTop: 18 }}>
          <label htmlFor="new-channel">Add a show: YouTube @handle, channel URL, channel ID, or a podcast RSS feed link</label>
          <input id="new-channel" type="text" value={input} onChange={(e) => { setInput(e.target.value); setPreview(null); }} maxLength={200} placeholder="@LennysPodcast" required />
          <label htmlFor="new-host">Host name (so the host is never listed as a guest)</label>
          <input id="new-host" type="text" value={host} onChange={(e) => setHost(e.target.value)} maxLength={80} />
          <p style={{ marginTop: 14 }}><button className="btn ghost" type="submit" disabled={busy === 'preview'}>{busy === 'preview' ? 'Checking with YouTube…' : 'Check channel'}</button></p>
        </form>
        {busy === 'preview' && <div className="skeleton" style={{ marginTop: 12, width: 220 }} />}
        {preview && (
          <div className="chan" style={{ marginTop: 10 }}>
            {preview.thumbnail && <img src={preview.thumbnail} alt="" width="40" height="40" />}
            <div className="grow"><strong>{preview.title}</strong><div className="muted">Is this the right show?{preview.episodes ? ` ${preview.episodes} episodes found.` : ''}</div></div>
            <button className="btn" onClick={confirmAdd} disabled={busy === 'add'}>{busy === 'add' ? 'Saving…' : 'Yes, add it'}</button>
          </div>
        )}
      </div>

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
      {msg && <div className="toast" role="status" data-toast>{msg}</div>}
    </div>
  );
}
