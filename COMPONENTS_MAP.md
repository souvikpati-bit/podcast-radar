# Components Map notes (for submission)

Files: `components-map.pdf` (submit this), `components-map.png`, `components-map.svg`. Same swim-lane layout as the first version.

Lanes: Aditya, GitHub, Vercel, YouTube Data API v3, Podcast RSS + Apple directory, Neon, Code (Next.js server), Gemini API, Review Gate (Aditya), Resend.

Flow: Vercel Cron (UTC) -> YouTube Data API v3 (uploads, stats) and Podcast RSS feeds -> Neon (shows, episodes, extractions, snapshot) -> Code prepares the data (guest episodes only, duplicates dropped) -> Gemini Flash (guests with role and company, topics, brands, email opening) -> Code scores and saves the snapshot -> Resend emails the brief to Aditya -> Aditya opens the dashboard -> Review Gate (shortlist, dismiss, contacted, confirmed, sponsored) -> Neon. GitHub holds the code; CI (lint, tests, build) must pass; Vercel deploys on every push.

Changes from the first version:
1. Shows come from YouTube and podcast RSS feeds. Aditya adds or removes them (max 10) on the dashboard or in Settings, no code change.
2. Thin data fixes itself: a show with few guest episodes gets its podcast feed attached (Apple free directory); up to 3 shows may be added automatically.
3. Founders are ranked independently of topics; founders only; media round = same founder on 2+ shows within 30 days.
4. Topics ranked by how many shows cover them at the same time (last 30 days); exactly 6, never padded.
5. Review Gate: Shortlist / Dismiss / Contacted / Confirmed (removes a guest from the list) / Sponsored, with CSV export. It sends nothing to anyone.
6. Fallback chain: live data -> last good snapshot in Neon -> bundled demo data, labelled in the banner.
7. Two crons, in UTC: daily refresh `30 20 * * *` (02:00 IST), Monday brief `0 0 * * 1` (05:30 IST). CI must pass before deploy.
