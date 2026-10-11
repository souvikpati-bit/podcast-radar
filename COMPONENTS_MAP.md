# Components Map notes (for submission)

Lanes: Aditya, GitHub, Vercel, YouTube Data API v3, Neon, Code (Next.js server), Gemini API, Review Gate (Aditya), Resend.

Flow: Vercel Cron (UTC) -> Code (Next.js server) -> YouTube Data API v3 (uploads, stats) -> Neon (videos, extractions, snapshot) -> Gemini API (guests, topics, brands, email opening) -> Code scores and saves the snapshot -> Resend emails the brief to Aditya -> Aditya opens the dashboard -> Review Gate (shortlist, dismiss, contacted, booked, sponsored) -> Neon. GitHub holds the code; Vercel deploys it on every push.

Changes from the first version:
1. Topic count fixed to exactly 6 (never padded).
2. Review Gate shortlist added: Shortlist / Dismiss / Contacted outside app / Booked / Sponsored, with CSV export. It sends nothing to anyone and gives the impact numbers (guests booked, sponsors won).
3. Fallback chain: live data -> last good snapshot in Neon -> bundled demo data, always labelled in the banner.
4. Two crons, shown in UTC: daily refresh `30 20 * * *`, Monday brief `0 0 * * 1` (05:30 IST).
