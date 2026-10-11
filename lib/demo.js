// Bundled demo data: fictional shows, people and brands. Always labelled "demo" in the UI.
// Dates are generated relative to "now" so the demo always looks recent.

const CHANNELS = [
  ['Founder Stack', 'Rhea Kapoor'],
  ['Zero to Series A', 'Marcus Webb'],
  ['The Bootstrap Hour', 'Ishaan Mehra'],
  ['Unicorn Diaries', 'Priya Nambiar'],
  ['Build in Public Pod', 'Tom Alvarez'],
  ['Startup Sutra', 'Karan Bhalla'],
  ['Operators Only', 'Dana Whitfield'],
  ['Funding Friday', 'Neel Shah'],
  ['Product Market Talk', 'Sara Lindqvist'],
  ['India Builders', 'Vikram Rao'],
];

const GUESTS = [
  'Ananya Rao', 'Jordan Ellis', 'Meera Subramaniam', 'Chris Donovan', 'Farhan Qureshi', 'Leah Brennan',
  'Rohit Sinha', 'Elena Petrova', 'Aman Verma', 'Sophie Laurent', 'Devika Menon', 'Hugo Martins',
  'Tanvi Joshi', 'Noah Fischer', 'Kabir Anand', 'Isabel Cruz', 'Arjun Malhotra', 'Grace Okafor',
  'Siddharth Iyer', 'Maya Collins', 'Yash Agarwal', 'Olivia Hart', 'Rahul Desai', 'Nina Kowalski',
];

const TOPICS = [
  'AI agents for startups', 'Fundraising in a tough market', 'Founder mental health', 'Bootstrapping to profit',
  'Hiring your first 10', 'Go-to-market for B2B SaaS', 'Pricing and monetisation', 'Creator economy and startups',
  'D2C brand building', 'Fintech and payments', 'Climate tech', 'Layoffs and cost control',
];

const BRANDS = ['Zenpay', 'Loomwork', 'Beacon CRM', 'Quillnote', 'Stackhive', 'Tallyfy Books', 'Orbit Mail', 'Pixelforge', 'Nimbus Cloud', 'Carta Lane'];

const VERBS = ['How', 'Why', 'Inside', 'Lessons from', 'The truth about', 'What nobody tells you about'];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoDataset(now = new Date()) {
  const rand = rng(20261011);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const channels = CHANNELS.map(([title, host], i) => ({ key: `demo-${i + 1}`, title, host_name: host, median_hint: 8000 + i * 4500 }));
  const videos = [];
  // Two "hot" guests booked on several shows recently (a media round) and two hot topics.
  const hotGuests = ['Ananya Rao', 'Jordan Ellis', 'Farhan Qureshi'];
  const hotTopics = ['AI agents for startups', 'Fundraising in a tough market'];
  let n = 0;
  for (const ch of channels) {
    const count = 11 + Math.floor(rand() * 3); // ~12 per channel => ~120 total
    for (let k = 0; k < count; k++) {
      const daysAgo = k < 5 ? Math.floor(rand() * 14) + 1 : Math.floor(rand() * 85) + 3;
      const recent = daysAgo <= 30;
      const hot = recent && rand() < 0.35;
      const topic = hot ? pick(hotTopics) : pick(TOPICS);
      const guest = hot && rand() < 0.6 ? pick(hotGuests) : pick(GUESTS);
      const hotBoost = hotTopics.includes(topic) ? 1.5 : 1;
      const views = Math.round(ch.median_hint * (0.4 + rand() * 1.6) * hotBoost * (daysAgo < 3 ? 0.3 : 1));
      const hiddenLikes = rand() < 0.04;
      const likes = hiddenLikes ? null : Math.round(views * (0.02 + rand() * 0.04));
      const comments = hiddenLikes ? null : Math.round(views * (0.002 + rand() * 0.004));
      const brandList = [];
      if (rand() < 0.35) brandList.push({ name: pick(BRANDS), sponsored: rand() < 0.55 });
      const published = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(rand() * 40000000));
      n += 1;
      videos.push({
        video_id: `demo${String(n).padStart(3, '0')}`,
        channel_key: ch.key,
        channel_title: ch.title,
        title: `${pick(VERBS)} ${topic.toLowerCase()} with ${guest}`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(guest + ' ' + ch.title)}`,
        published_at: published.toISOString(),
        views,
        likes,
        comments,
        is_short: false,
        guests: [guest],
        topics: [topic],
        brands: brandList,
        method: 'demo',
      });
    }
  }
  return { generated_at: now.toISOString(), channels, videos, label: 'demo' };
}
