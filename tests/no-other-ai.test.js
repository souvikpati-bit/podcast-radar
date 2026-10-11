import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FORBIDDEN = /(@anthropic-ai|anthropic\.com|api\.openai\.com|from ['"]openai['"]|require\(['"]openai['"]\)|"openai"|"anthropic")/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', 'tests', '.vercel'].includes(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|json|jsx|css)$/.test(name) && name !== 'package-lock.json') out.push(p);
  }
  return out;
}

test('no Anthropic or OpenAI SDK or URL anywhere in the source', () => {
  const offenders = walk(ROOT).filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('no secret uses NEXT_PUBLIC_', () => {
  const offenders = walk(ROOT).filter((f) => /NEXT_PUBLIC_(.*KEY|.*SECRET|.*TOKEN)/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
