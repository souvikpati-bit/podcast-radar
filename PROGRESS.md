# PROGRESS

- **M0 Scaffold**: Next.js app, `lib/env.js` (single env reader), docs, first Vercel deploy. Done.
- **M1 Data**: YouTube client (cached IDs, pagination, unit counting, key sent in a header), cleaning, Shorts filter, migrations, ~120-video demo data. Tests with a mocked API. A live single-channel check needs your key: `node --env-file=.env.local scripts/check-channel.js @LennysPodcast`.
- **M2 Extraction**: Gemini batches with response schema, code validation against the video text, alias/brand normalisation, taxonomy, keyword fallback, cache. Done.
- **M3 Scoring**: pure functions + `config/scoring.json`, edge-case tests, printed table from demo data. Done.
- **M4 Pipeline**: staged resumable refresh, runs log, snapshots, fallback chain (tested with an in-memory Postgres).
- **M5 Dashboard**, **M6 Settings/Review Gate/health**, **M7 Brief email + archive**, **M8 Cron + idempotency**: done and tested.
- **M9 Design + GSAP**: dark signal-room design, SplitText intro, Flip topic selection, ScrollTrigger reveals, reduced-motion and no-JS safe. Lenis skipped on purpose (risk of touch-scroll jank). Lighthouse and live-scroll checks could not be run: the browser pane was hidden during the session.
- **M10 Hardening + examiner review**: fixed empty-snapshot overwrite, check-run pollution, brief retry when no row, sponsor-name leak, public error text, security headers, file tracing for migrations, partial-null likes, and more. 33 tests pass.

Tests: `npm test` (33 pass), `npm run lint` clean, `npm run build` green.
