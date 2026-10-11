import { requireAdmin } from '@/lib/auth';
import { refreshStep } from '@/lib/pipeline';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// One step of the staged refresh. The Settings page calls this repeatedly until done.
export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body starts a new run */
  }
  const s = body.state;
  const valid = s && Number.isInteger(s.runId) && ['init', 'fetch', 'extract', 'score'].includes(s.stage) && Number.isInteger(s.cursor) && s.cursor >= 0;
  const out = await refreshStep(valid ? { runId: s.runId, stage: s.stage, cursor: s.cursor } : null);
  return Response.json(out);
}
