import cfg from '../config/pipeline.json' with { type: 'json' };
import { safeQuery } from './db.js';

export async function getHealth() {
  const runs = await safeQuery(`SELECT id, kind, started_at, finished_at, status, units_used, videos_fetched, gemini_calls, emails_sent, failures_json FROM runs ORDER BY id DESC LIMIT 8`);
  const today = await safeQuery(
    `SELECT COALESCE(SUM(units_used),0)::int AS units, COALESCE(SUM(gemini_calls),0)::int AS gemini, COALESCE(SUM(emails_sent),0)::int AS emails
     FROM runs WHERE started_at >= date_trunc('day', now() at time zone 'utc')`,
  );
  const brief = await safeQuery('SELECT week_start, status, sent_at, error FROM briefs ORDER BY week_start DESC LIMIT 1');
  const lastRefresh = runs.ok ? runs.rows.find((r) => r.kind === 'refresh') : null;
  const failedChannels = lastRefresh ? (lastRefresh.failures_json || []).filter((f) => f.channel && f.channel !== '-') : [];
  const t = today.ok ? today.rows[0] : { units: 0, gemini: 0, emails: 0 };
  return {
    dbOk: runs.ok,
    dbError: runs.ok ? null : runs.error,
    runs: runs.ok ? runs.rows : [],
    today: t,
    unitAlert: t.units > cfg.dailyUnitAlert,
    unitBudget: cfg.dailyUnitBudget,
    failedChannels,
    lastBrief: brief.ok ? brief.rows[0] || null : null,
  };
}
