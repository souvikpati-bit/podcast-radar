// One-click searches for a founder, Google first. They are searches (name + company), not guessed profile addresses.
export function FounderLinks({ search }) {
  const links = [
    ['Google', search.google],
    ['LinkedIn', search.linkedin],
    ['X', search.x],
    ['Instagram', search.instagram],
  ];
  return (
    <div className="reach">
      <div className="reach-row">
        <span className="reach-l mono">Find</span>
        {links.map(([label, href]) => (
          <a key={label} className="chip" href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a>
        ))}
      </div>
    </div>
  );
}
