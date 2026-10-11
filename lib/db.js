import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getEnv } from './env.js';

let sqlFn = null;
let testClient = null; // tests inject an in-memory Postgres here

export function __setTestClient(fn) {
  testClient = fn;
  schemaReady = null;
}
let schemaReady = null;

export function dbConfigured() {
  return Boolean(testClient || getEnv().databaseUrl);
}

function client() {
  if (!sqlFn) {
    const url = getEnv().databaseUrl;
    if (!url) return null;
    sqlFn = neon(url);
  }
  return sqlFn;
}

// Parameterised queries only: query('SELECT * FROM t WHERE id = $1', [id]). Returns rows, or null if no database.
export async function query(text, params = []) {
  if (testClient) return testClient(text, params);
  const sql = client();
  if (!sql) return null;
  return sql.query(text, params);
}

export async function ensureSchema() {
  const sql = testClient ? { query: testClient } : client();
  if (!sql) return false;
  if (!schemaReady) {
    schemaReady = (async () => {
      const file = path.join(process.cwd(), 'migrations', '001_init.sql');
      const statements = readFileSync(file, 'utf8')
        .split(/;\s*\n/)
        .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
        .filter(Boolean);
      for (const stmt of statements) await sql.query(stmt);
      return true;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// Safe wrapper: returns { ok, rows, error } so pages never crash because the DB is down.
export async function safeQuery(text, params = []) {
  try {
    if (!dbConfigured()) return { ok: false, rows: [], error: 'DATABASE_URL not set' };
    await ensureSchema();
    const rows = await query(text, params);
    return { ok: true, rows: rows || [], error: null };
  } catch (err) {
    return { ok: false, rows: [], error: String(err.message || err).slice(0, 200) };
  }
}
