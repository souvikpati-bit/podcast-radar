import { requireAdmin } from '@/lib/auth';
import { actionsToCsv, listActions } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const csv = actionsToCsv(await listActions());
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="review-gate.csv"' } });
}
