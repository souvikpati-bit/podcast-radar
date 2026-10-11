// The ONLY place that reads environment variables. Reports what is missing instead of crashing.

const read = (name) => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : '';
};

export function getEnv() {
  const vercelUrl = read('VERCEL_PROJECT_PRODUCTION_URL') || read('VERCEL_URL');
  return {
    youtubeKey: read('YOUTUBE_API_KEY'),
    geminiKey: read('GEMINI_API_KEY'),
    geminiModel: /flash/i.test(read('GEMINI_MODEL')) ? read('GEMINI_MODEL') : 'gemini-flash-latest', // Flash models only
    databaseUrl: read('DATABASE_URL'),
    resendKey: read('RESEND_API_KEY'),
    resendFrom: read('RESEND_FROM') || 'onboarding@resend.dev',
    briefTo: read('BRIEF_TO_EMAIL'),
    adminKey: read('ADMIN_KEY'),
    cronSecret: read('CRON_SECRET'),
    appUrl: read('APP_URL') || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000'),
    showSponsorNames: ['', 'true', '1', 'yes', 'on'].includes(read('SHOW_SPONSOR_NAMES').toLowerCase()),
  };
}

// Names only (never values) so it is safe to show in System health.
export function missingKeys() {
  const e = getEnv();
  const m = [];
  if (!e.youtubeKey) m.push({ name: 'YOUTUBE_API_KEY', effect: 'Showing demo or stored data instead of live data' });
  if (!e.geminiKey) m.push({ name: 'GEMINI_API_KEY', effect: 'Using keyword fallback instead of Gemini' });
  if (!e.databaseUrl) m.push({ name: 'DATABASE_URL', effect: 'No database: demo data only, nothing is saved' });
  if (!e.resendKey) m.push({ name: 'RESEND_API_KEY', effect: 'Cannot send the Monday email' });
  if (!e.briefTo) m.push({ name: 'BRIEF_TO_EMAIL', effect: 'No email recipient' });
  if (!e.adminKey) m.push({ name: 'ADMIN_KEY', effect: 'Settings page is locked' });
  if (!e.cronSecret) m.push({ name: 'CRON_SECRET', effect: 'Cron routes return 401' });
  return m;
}
