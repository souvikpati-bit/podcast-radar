# DECISIONS

Scores 1 to 5 on (a) free tiers, (b) works at submission even if a key/API fails, (c) beginner can maintain, (d) honest/accurate, (e) clear in demo. Total out of 25.

## D1 Getting data
- A uploads playlist: `channels.list` + `playlistItems.list` + `videos.list` (5+5+4+5+5 = 24) **PICK**
- B `search.list` (1+3+4+4+4 = 16): 100 units/call, banned
- C scraping/transcripts (3+2+1+3+2 = 11): fragile, ToS risk
- Reason: ~6-8 units per channel, official, stable.

## D2 Extracting guests, topics, brands
- A Gemini batches of ~20 with response schema + code validation + keyword fallback (5+5+4+5+5 = 24) **PICK**
- B keyword rules only (5+5+5+2+3 = 20)
- C one call per video (3+3+4+5+4 = 19)
- Reason: batching saves free-tier calls; validation enforces "never invent a name".

## D3 What "probability" means
- A smoothed hit rate on mature videos (5+5+4+5+5 = 24) **PICK**
- B score x 10 only (5+5+5+2+3 = 20)
- C trained model (2+2+1+3+2 = 10)
- Reason: `(hits+1)/(n+2)` is explainable in one sentence.

## D4 Guests per topic
- A precompute for all 6 topics at refresh, ship in page (5+5+5+5+5 = 25) **PICK**
- B compute per click (4+3+3+5+3 = 18)
- C ask Gemini to rank (3+2+3+2+3 = 13)
- Reason: instant switching, no spinner, no extra AI.

## D5 Same guest spelled two ways
- A normalise + fuzzy match + alias table; ambiguous logged not merged (5+5+4+5+4 = 23) **PICK**
- B Gemini dedupe (4+3+4+3+3 = 17)
- C exact match only (5+5+5+2+3 = 20)
- Reason: deterministic and auditable.

## D6 Stable topic names
- A persistent taxonomy, map new tags onto it, recluster weekly (5+5+4+5+4 = 23) **PICK**
- B recluster every run (4+4+4+3+3 = 18)
- C no clustering (5+5+5+2+2 = 19)
- Reason: topic names must not jump around day to day.

## D7 Long refresh vs 60s limit
- A staged resumable pipeline; "Refresh now" loops calling it until done (5+5+4+5+5 = 24) **PICK**
- B one big function (5+2+5+4+3 = 19)
- C background queue service (2+3+2+5+3 = 15, extra service)
- Reason: each step fits well inside the function limit.

## Locked by the exam (no scoring)
Vercel Cron for scheduling; Neon for storage and seed fallback; Next.js for structure.
