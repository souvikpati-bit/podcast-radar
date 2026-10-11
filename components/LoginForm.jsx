'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr((await res.json().catch(() => ({}))).error || 'Login failed');
  }
  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 40 }}>Aditya&apos;s login</h1>
      <p className="muted" style={{ marginTop: 6 }}>Enter the admin key to manage channels, refresh data and use the Review Gate.</p>
      <label htmlFor="key">Admin key</label>
      <input id="key" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} required />
      {err && <p className="status-bad" role="alert" style={{ marginTop: 10 }}>{err}</p>}
      <p style={{ marginTop: 18 }}><button className="btn" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button></p>
    </form>
  );
}
