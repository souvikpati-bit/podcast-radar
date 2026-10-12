// Runs the staged data refresh from the browser: calls /api/refresh step by step until it reports done.
// onProgress receives { pct, label }. Returns { ok, message }.
export async function runRefresh(onProgress = () => {}) {
  let state = null;
  onProgress({ pct: 2, label: 'Starting' });
  for (let i = 0; i < 80; i++) {
    const res = await fetch('/api/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error || 'Refresh failed' };
    onProgress(data.progress || { pct: 50, label: 'Working' });
    if (data.done) return data.error ? { ok: false, message: `Refresh stopped: ${data.error}` } : { ok: true, message: data.progress?.label || 'Done' };
    state = data.state;
  }
  return { ok: false, message: 'Refresh took too long; it will finish in the daily refresh' };
}
