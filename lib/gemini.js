// Gemini Flash client (REST). The only AI service used by this app.
import { getEnv } from './env.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function geminiAvailable() {
  return Boolean(getEnv().geminiKey);
}

// Returns parsed JSON that matches `schema`. Counts calls in `counter.gemini`.
// Retries once on bad JSON and with backoff on 429/5xx. Throws GeminiError after that.
export async function generateJson({ system, prompt, schema, counter = { gemini: 0 }, fetchImpl = fetch, backoffMs = [800, 2500] }) {
  const { geminiKey, geminiModel } = getEnv();
  if (!geminiKey) throw new GeminiError('GEMINI_API_KEY is not set', 'no_key');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 },
  };
  let badJson = 0;
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    counter.gemini = (counter.gemini || 0) + 1;
    let res;
    try {
      res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey }, body: JSON.stringify(body) });
    } catch {
      if (attempt < backoffMs.length) {
        await sleep(backoffMs[attempt]);
        continue;
      }
      throw new GeminiError('Could not reach Gemini', 'network');
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < backoffMs.length) {
        await sleep(backoffMs[attempt]);
        continue;
      }
      throw new GeminiError(`Gemini busy (${res.status})`, res.status === 429 ? 'rate_limit' : 'server');
    }
    if (!res.ok) throw new GeminiError(`Gemini request failed (${res.status})`, `http_${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      badJson += 1;
      if (badJson > 1) throw new GeminiError('Gemini returned invalid JSON twice', 'bad_json');
      // loop again: one retry on bad JSON
      attempt -= 1;
      if (attempt < -1) break;
    }
  }
  throw new GeminiError('Gemini failed', 'unknown');
}
