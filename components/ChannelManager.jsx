'use client';
/* eslint-disable @next/next/no-img-element -- channel thumbnails come from YouTube and are tiny */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// A podcast RSS feed link (anything http(s) that is not a YouTube address).
const isFeed = (s) => /^https?:\/\//i.test(s.trim()) && !/youtube\.com|youtu\.be/i.test(s);

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function kind(c) {
  if (c.feed_url) return c.youtube_channel_id ? 'YouTube + podcast feed' : 'Podcast RSS feed';
  return 'YouTube';
}

// The list of monitored shows. Everyone can see it; Aditya (logged in) can add, remove and set hosts without touching code.
export function ChannelManager({ channels, maxChannels, admin, dbError, showAccount = false }) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [host, setHost] = useState('');
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [key, setKey] = useState('');
  const [job, setJob] = useState(null); // { label } while the dashboard is updating after a change
  const timer = useRef(null);
  const full = channels.length >= maxChannels;


  // Follow the server while it brings in a new show; refresh the page when it is done.
  const watch = useCallback(() => {
    clearInterval(timer.current);
    const tick = async () => {
      let st = null;
      try {
        const res = await fetch('/api/refresh/status', { cache: 'no-store' });
        if (res.ok) st = await res.json();
      } catch {
        /* try again on the next tick */
      }
      if (!st) return;
      if (st.running) {
        setJob({ label: st.label });
        return;
      }
      clearInterval(timer.current);
      setJob(null);
      const note = (st.notes || []).slice(-1)[0];
      setMsg(note || (st.failures?.[0] ? `The update stopped: ${st.failures[0]}` : 'The dashboard is up to date.'));
      setTimeout(() => setMsg(''), 9000);
      router.refresh();
    };
    setJob((j) => j || { label: 'Starting' });
    timer.current = setInterval(tick, 2000);
    tick();
  }, [router]);

  useEffect(() => {
    if (!admin) return undefined;
    // If a refresh is already working (for example the page was reloaded), show it
    fetch('/api/refresh/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((st) => st?.running && watch()).catch(() => {});
    return () => clearInterval(timer.current);
  }, [admin, watch]);

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
    else toast(r.data.error || 'Could not check that show');
  }
  async function confirmAdd() {
    setBusy('add');
    const r = await post('/api/channels', { action: isFeed(input) ? 'add-feed' : 'add', input, host });
    setBusy('');
    if (r.ok) {
      setInput('');
      setHost('');
      setPreview(null);
      router.refresh();
      if (r.data.refreshing) {
        toast(`Added ${r.data.channel.title}. Bringing in its episodes now.`);
        watch();
      } else toast(`Added ${r.data.channel.title}. Its episodes arrive with the next daily update.`);
    } else toast(r.data.error || 'Could not add');
  }
  async function remove(c) {
    if (!window.confirm(`Remove ${c.title || c.handle}? Its episodes are removed from the dashboard.`)) return;
    const r = await post('/api/channels', { action: 'remove', id: c.id });
    if (r.ok) {
      toast(`Removed ${c.title || c.handle}. The dashboard is updated.`);
      router.refresh();
    } else toast(r.data.error || 'Could not remove');
  }
  async function login(e) {
    e.preventDefault();
    setBusy('login');
    const r = await post('/api/login', { key });
    setBusy('');
    if (r.ok) {
      setKey('');
      router.refresh();
    } else toast(r.data.error || 'Wrong key');
  }
  async function logout() {
    await post('/api/logout');
    router.refresh();
  }
  async function saveHost(c, value) {
    const r = await post('/api/channels', { action: 'host', id: c.id, host: value });
    toast(r.ok ? 'Host saved' : r.data.error || 'Could not save');
  }

  return (
    <div>
      {showAccount && (admin ? (
        <div className="acct" role="group" aria-label="Account">
          <span className="acct-who"><i aria-hidden="true" />Logged in as Aditya. You can add, remove and rename shows below.</span>
          <span className="acct-act"><Link className="btn ghost" href="/settings">Open Settings</Link><button className="btn ghost" type="button" onClick={logout}>Log out</button></span>
        </div>
      ) : (
        <form id="edit-shows" onSubmit={login} className="acct" aria-label="Log in to edit shows">
          <span className="acct-who"><strong>Aditya:</strong> log in to add or remove shows. No code needed.</span>
          <span className="acct-act">
            <label htmlFor="edit-key" className="sr-only">Admin key</label>
            <input id="edit-key" type="password" autoComplete="current-password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} required />
            <button className="btn" type="submit" disabled={busy === 'login'}>{busy === 'login' ? 'Checking…' : 'Log in'}</button>
          </span>
        </form>
      ))}
      {job && (
        <div className="acct" role="status" aria-live="polite">
          <span className="acct-who"><i aria-hidden="true" />Updating the dashboard: {job.label}…</span>
          <span className="muted mono" style={{ fontSize: 12 }}>You can leave this page; it keeps going.</span>
        </div>
      )}
      {dbError && <p className="note">Database not available: {dbError}. Shows cannot be saved until DATABASE_URL is set.</p>}
      {channels.length === 0 && !dbError && <p className="muted">No shows yet. The default list is added on the first refresh{admin ? ', or add your own below' : ''}.</p>}
      {channels.map((c, i) => (
        <div className="chan" key={c.id}>
          <span className="mono muted" style={{ width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
          {c.thumbnail ? <img src={c.thumbnail} alt="" width="40" height="40" /> : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--line)' }} />}
          <div className="grow">
            <strong>{c.title || c.handle}</strong>
            <div className="muted mono" style={{ fontSize: 12 }}>{kind(c)}{c.host_name ? ` · host: ${c.host_name}` : ''}{c.auto_added ? ' · added automatically' : ''}</div>
          </div>
          {!admin && <a className="btn ghost" href="#edit-shows" aria-label={`Remove ${c.title || c.handle} (log in first)`}>Remove</a>}
          {admin && (
            <>
              <div>
                <label htmlFor={`host-${c.id}`} style={{ margin: 0 }}>Host</label>
                <input id={`host-${c.id}`} type="text" defaultValue={c.host_name || ''} maxLength={80} placeholder="Host name" onBlur={(e) => e.target.value !== (c.host_name || '') && saveHost(c, e.target.value)} />
              </div>
              <button className="btn ghost" onClick={() => remove(c)} disabled={Boolean(job) || busy === 'add'} aria-label={`Remove ${c.title || c.handle}`}>Remove</button>
            </>
          )}
        </div>
      ))}

      {admin ? (
        <>
          {full ? (
            <p className="note" style={{ marginTop: 16 }}>You are tracking {maxChannels} of {maxChannels} shows. Remove one to add another.</p>
          ) : (
            <form onSubmit={doPreview} style={{ marginTop: 18 }}>
              <label htmlFor="new-channel">Add a show: YouTube @handle, channel URL, channel ID, or a podcast RSS feed link</label>
              <input id="new-channel" type="text" value={input} onChange={(e) => { setInput(e.target.value); setPreview(null); }} maxLength={200} placeholder="@LennysPodcast, a channel link, or a show name" required />
              <label htmlFor="new-host">Host name (so the host is never listed as a guest)</label>
              <input id="new-host" type="text" value={host} onChange={(e) => setHost(e.target.value)} maxLength={80} />
              <p style={{ marginTop: 14 }}><button className="btn ghost" type="submit" disabled={busy === 'preview'}>{busy === 'preview' ? 'Checking…' : 'Check show'}</button></p>
            </form>
          )}
          {busy === 'preview' && <div className="skeleton" style={{ marginTop: 12, width: 220 }} />}
          {preview && (
            <div className="chan" style={{ marginTop: 10 }}>
              {preview.thumbnail && <img src={preview.thumbnail} alt="" width="40" height="40" />}
              <div className="grow"><strong>{preview.title}</strong><div className="muted">Is this the right show?{preview.episodes ? ` ${preview.episodes} episodes found.` : ''}</div></div>
              <button className="btn" onClick={confirmAdd} disabled={busy === 'add' || Boolean(job)}>{busy === 'add' ? 'Saving…' : job ? 'Updating…' : 'Yes, add it'}</button>
            </div>
          )}
        </>
      ) : null}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}
