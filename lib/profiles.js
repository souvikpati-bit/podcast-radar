// Ready-made search links for a founder. They are searches, never guessed profile addresses.
// The search lands on a results page where the person is usually first, because the company is in the query.
export function searchLinks(name, company = '') {
  const who = [name, company].filter(Boolean).join(' ');
  const q = encodeURIComponent(who);
  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(`"${name}"`)}${company ? `+${encodeURIComponent(company)}` : ''}`,
    linkedin: `https://www.linkedin.com/search/results/people/?keywords=${q}`,
    x: `https://x.com/search?q=${q}&f=user`,
    instagram: `https://www.google.com/search?q=${q}+site%3Ainstagram.com`,
  };
}
