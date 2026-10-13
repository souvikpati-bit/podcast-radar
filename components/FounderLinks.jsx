// One-click searches for a founder, Google first. They are searches (name + company), not guessed profile addresses.
export function FounderLinks({ search }) {
  const links = [
    ['Google', 'google', search.google],
    ...(search.website ? [['Website', 'website', search.website]] : []),
    ['LinkedIn', 'linkedin', search.linkedin],
    ['X', 'x', search.x],
    ['Instagram', 'instagram', search.instagram],
  ];
  return (
    <div className="reach">
      <div className="reach-row">
        <span className="reach-l mono">Find</span>
        {links.map(([label, net, href]) => (
          <a key={label} className={`find find-${net}`} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a>
        ))}
      </div>
    </div>
  );
}
