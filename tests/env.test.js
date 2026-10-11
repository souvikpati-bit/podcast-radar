import test from 'node:test';
import assert from 'node:assert';
import { getEnv, missingKeys } from '../lib/env.js';

test('env reports missing keys without crashing', () => {
  const e = getEnv();
  assert.ok(typeof e.geminiModel === 'string');
  assert.ok(Array.isArray(missingKeys()));
});
