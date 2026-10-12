// Circular probability gauge. The final state is in the markup, so it shows without JavaScript; GSAP draws it in.
const C = 2 * Math.PI * 18;

export function ProbRing({ value, label = 'model estimate from the data' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring-wrap" role="img" aria-label={`${Math.round(v)} percent, ${label}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="ring-bg" cx="22" cy="22" r="18" />
        <circle className="ring-fg" cx="22" cy="22" r="18" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} data-ringfg data-circ={C} data-target={C * (1 - v / 100)} transform="rotate(-90 22 22)" />
      </svg>
      <span className="ring-n mono" data-count={Math.round(v)} data-dec="0" data-suffix="%">{Math.round(v)}%</span>
    </div>
  );
}
