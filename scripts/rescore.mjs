// Re-score the stored videos and refresh the trend data without using any YouTube or Gemini quota.
// Usage: node --env-file=.env.local scripts/rescore.mjs
import { rescoreAndSave } from '../lib/pipeline.js';
import { getDashboardData } from '../lib/snapshot.js';

const r = await rescoreAndSave();
console.log('saved:', r.saved);
const d = await getDashboardData();
const t = d.snapshot.results.trends;
console.log('weeks:', t?.weeks?.join(', '));
for (const topic of d.snapshot.results.topics) {
  console.log(`${topic.rank}. ${topic.topic} | episodes/week ${JSON.stringify(topic.weekly8)} | interest ${JSON.stringify(t?.interest?.[topic.topic] || null)}`);
}
console.log('error:', t?.error || 'none');
