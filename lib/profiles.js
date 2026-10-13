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

// Searches for a brand (a sponsor): Google first, then the company pages on LinkedIn, X and Instagram. Searches, never guessed addresses.
export function brandLinks(brand, website = '') {
  const q = encodeURIComponent(brand);
  const host = website ? new URL(website).hostname.replace(/^www\./, '') : '';
  return {
    // with the brand's own address in the search, a common word such as "Lifespan" finds the right company
    google: `https://www.google.com/search?q=${encodeURIComponent(`"${brand}"`)}${host ? `%20${encodeURIComponent(host)}` : ''}`,
    ...(website ? { website } : {}),
    linkedin: `https://www.linkedin.com/search/results/companies/?keywords=${q}`,
    x: `https://x.com/search?q=${q}&f=user`,
    instagram: `https://www.google.com/search?q=${q}+site%3Ainstagram.com`,
  };
}
