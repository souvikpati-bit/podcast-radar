// Review Gate: Aditya's private notebook. Nothing here sends anything to anyone.
import { safeQuery } from './db.js';

export const STATUSES = ['shortlisted', 'dismissed', 'contacted', 'booked', 'sponsored'];
export const TYPES = ['topic', 'guest', 'sponsor'];

export async function listActions() {
  const r = await safeQuery('SELECT entity_type, entity_key, status, note, updated_at FROM actions ORDER BY updated_at DESC');
  return r.ok ? r.rows : [];
}

export async function actionMap() {
  const rows = await listActions();
  return Object.fromEntries(rows.map((a) => [`${a.entity_type}:${a.entity_key}`, a.status]));
}

export async function setAction(type, key, status, note = '') {
  if (!TYPES.includes(type)) throw new Error('Bad type');
  const k = String(key || '').trim().slice(0, 120);
  if (!k) throw new Error('Missing name');
  if (status === 'clear') {
    return safeQuery('DELETE FROM actions WHERE entity_type = $1 AND entity_key = $2', [type, k]);
  }
  if (!STATUSES.includes(status)) throw new Error('Bad status');
  return safeQuery(
    `INSERT INTO actions (entity_type, entity_key, status, note) VALUES ($1,$2,$3,$4)
     ON CONFLICT (entity_type, entity_key) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()`,
    [type, k, status, String(note || '').slice(0, 300)],
  );
}

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // blocks spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export function actionsToCsv(rows) {
  const head = ['type', 'name', 'status', 'note', 'updated_at'];
  const lines = rows.map((r) => [r.entity_type, r.entity_key, r.status, r.note || '', new Date(r.updated_at).toISOString()].map(csvCell).join(','));
  return [head.join(','), ...lines].join('\n') + '\n';
}

export function impactCounts(rows) {
  return {
    guestsBooked: rows.filter((r) => r.entity_type === 'guest' && r.status === 'booked').length,
    sponsorsWon: rows.filter((r) => r.entity_type === 'sponsor' && r.status === 'sponsored').length,
  };
}
