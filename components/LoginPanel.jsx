'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginForm } from './LoginForm';

// The login block on the main page: the login form when logged out, a short status with a log-out button when logged in.
export function LoginPanel({ admin }) {
  const router = useRouter();
  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.refresh();
  }
  if (!admin) return <LoginForm />;
  return (
    <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 36 }}>You are logged in</h2>
      <p className="muted" style={{ marginTop: 6 }}>You can add or remove shows (Shows block), use the Review Gate buttons, and open Settings to refresh data or send the brief.</p>
      <p style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn" href="/settings">Open Settings</Link>
        <button className="btn ghost" type="button" onClick={logout}>Log out</button>
      </p>
    </div>
  );
}
