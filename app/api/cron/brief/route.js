import { requireCron } from '@/lib/auth';
import { runRefreshToCompletion } from '@/lib/pipeline';
import { sendBrief } from '@/lib/brief';
import { safeQuery } from '@/lib/db';
import cfg from '@/config/pipeline.json';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Monday brief. If the data is older than 12 hours, refresh first, then send. Safe to call twice (idempotent per week).
export async function GET(request) {
  const denied = requireCron(request);
  if (denied) return denied;
  let refreshed = false;
  const age = await safeQuery(`SELECT EXTRACT(EPOCH FROM (now() - max(captured_at)))/3600 AS h FROM seed_snapshot WHERE source IN ('live','captured')`);
  const hours = age.ok && age.rows[0]?.h !== null && age.rows[0]?.h !== undefined ? Number(age.rows[0].h) : Infinity;
  if (hours > cfg.briefMaxAgeHours) {
    await runRefreshToCompletion({ budgetMs: 200000 });
    refreshed = true;
  }
  const out = await sendBrief();
  return Response.json({ refreshed, ok: out.ok, already: Boolean(out.already), message: out.message || null, error: out.error || null }, { status: 200 });
}
