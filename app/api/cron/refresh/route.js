import { requireCron } from '@/lib/auth';
import { runRefreshToCompletion } from '@/lib/pipeline';
import { sendBrief } from '@/lib/brief';
import { safeQuery } from '@/lib/db';
import { weekStart } from '@/lib/format';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Daily refresh. Also retries this week's brief if its send failed earlier (the failed status is stored).
export async function GET(request) {
  const denied = requireCron(request);
  if (denied) return denied;
  const out = await runRefreshToCompletion();
  let brief = null;
  const failed = await safeQuery(`SELECT 1 FROM briefs WHERE week_start = $1 AND status = 'failed'`, [weekStart()]);
  if (failed.ok && failed.rows.length) {
    const r = await sendBrief();
    brief = { ok: r.ok, message: r.message || r.error || null };
  }
  return Response.json({ done: out.done, status: out.status || null, skipped: Boolean(out.skipped), error: out.error || null, briefRetry: brief });
}
