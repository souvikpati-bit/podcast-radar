import { requireAdmin } from '@/lib/auth';
import { sendBrief } from '@/lib/brief';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let b = {};
  try {
    b = await request.json();
  } catch {
    /* default */
  }
  const out = await sendBrief({ force: b.force === true });
  return Response.json(out, { status: out.ok ? 200 : 400 });
}
