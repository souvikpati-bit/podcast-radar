import { requireAdmin } from '@/lib/auth';
import { setAction } from '@/lib/actions';
import { rescoreAndSave } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let b = {};
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  try {
    const r = await setAction(String(b.type), String(b.key), String(b.status), String(b.note || ''));
    if (r && r.ok === false) return Response.json({ error: r.error }, { status: 500 });
    // Confirming (or un-confirming) a guest changes who appears in the list, so re-score now. No API calls are used.
    if (b.type === 'guest') await rescoreAndSave();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err.message).slice(0, 120) }, { status: 400 });
  }
}
