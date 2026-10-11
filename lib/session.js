import { cookies } from 'next/headers';
import { COOKIE, verifyToken } from './auth.js';

export async function isAdminPage() {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}
