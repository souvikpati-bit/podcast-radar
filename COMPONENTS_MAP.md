# Components Map notes (for submission)

Files: `components-map.pdf` (submit this), `components-map.png`, `components-map.svg`. Same swim-lane layout as the first version.

Lanes: Aditya, GitHub, Vercel, YouTube Data API v3, Podcast RSS + Apple directory, Neon, Code (Next.js server), Gemini API, Review Gate (Aditya), Resend.

Flow: Vercel Cron (UTC) -> YouTube Data API v3 (uploads, stats) and Podcast RSS feeds -> Neon (shows, episodes, extractions, snapshot) -> Code prepares the data (guest episodes only, duplicates dropped) -> Gemini Flash (guests with role and company, topics, brands, email opening) -> Code scores and saves the snapshot -> dashboard (Shows, Topics, Guests, Sponsors, Your shortlist) and the Monday email via Resend -> Aditya decides with the Review Gate (shortlist, dismiss, contacted, confirmed, sponsored) -> Neon. GitHub holds the code; CI (lint, tests, build) must pass; Vercel deploys on every push. Adding a show reads just that show at once; removing a show or changing a host re-scores at once.

What changed from the first version:
1. Shows come from YouTube and podcast RSS feeds. Aditya adds or removes them (max 10) on the dashboard, no code. A new show is read at once; removing one updates the dashboard in seconds.
2. Thin data fixes itself: a show with few guest episodes gets its podcast feed attached (Apple free directory); up to 3 shows may be added.
3. Guests are ranked on their own, not per topic. Founders only. Media round = same guest on 2+ shows within 30 days.
4. Topics: exactly 6, the ones the most shows cover at the same time (last 30 days), grouped by audience response, never padded.
5. Plain ratings instead of raw percentages: topics (High, Steady, Mixed response), guests (Top, Strong, Good lead), sponsors (Active, Possible advertiser), each with its reasons.
6. One-click Find links for guests and sponsors: Google first, then LinkedIn, X, Instagram, plus a checked company website when the episodes name one.
7. Review Gate: shortlist, dismiss, contacted, Confirmed, sponsored, CSV, and a Your shortlist block that also appears in the Monday email. It sends nothing.
8. Fallback chain: live data -> last good snapshot -> demo data, labelled in a banner. One refresh a day (`30 20 * * *`, about 02:00 IST) plus the Monday brief (`0 0 * * 1`, 05:30 IST). CI must pass before deploy.
