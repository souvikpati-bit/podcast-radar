import { requireAdmin } from '@/lib/auth';
import { latestRefreshStatus } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

// What the latest refresh is doing, so the Shows block can show progress after a show is added. Admin only.
export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return Response.json(await latestRefreshStatus());
}
