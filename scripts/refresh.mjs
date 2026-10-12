// Run a full data refresh from the command line (same pipeline as the daily cron and the Settings button).
// Usage: node --env-file=.env.local scripts/refresh.mjs
import { runRefreshToCompletion } from '../lib/pipeline.js';
import { query } from '../lib/db.js';
import { listChannels } from '../lib/channels.js';

const ch = (await listChannels()).rows;
console.log('Shows:', ch.map((c) => c.title).join(' | '));
const r = await runRefreshToCompletion({ budgetMs: 480000 });
console.log('Result:', r.done ? 'done' : 'not finished', '|', r.progress?.label || '', r.error ? `| error: ${r.error}` : '');
const run = (await query("SELECT status, units_used, gemini_calls, videos_fetched, failures_json FROM runs WHERE kind = 'refresh' ORDER BY id DESC LIMIT 1"))[0];
console.log(`Run: ${run.status} | YouTube units ${run.units_used} | Gemini calls ${run.gemini_calls} | videos fetched ${run.videos_fetched}`);
const failures = (run.failures_json || []).slice(0, 6).map((f) => `${f.channel}: ${f.reason}`);
console.log('Failures:', failures.length ? failures.join(' ; ') : 'none');
