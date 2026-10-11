export function Hero({ children }) {
  return (
    <div className="hero">
      <svg className="radar" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
        {[60, 110, 160, 210, 255].map((r) => (
          <circle key={r} cx="260" cy="260" r={r} data-ring />
        ))}
        <g className="sweep" data-sweep>
          <line x1="260" y1="260" x2="260" y2="6" stroke="#c6f432" strokeWidth="1.5" opacity="0.8" />
          <path d="M260 260 L260 6 A254 254 0 0 1 380 40 Z" fill="url(#sweepfill)" opacity="0.35" />
        </g>
        <defs>
          <linearGradient id="sweepfill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c6f432" stopOpacity="0" /><stop offset="1" stopColor="#c6f432" stopOpacity="0.5" /></linearGradient>
        </defs>
      </svg>
      <div className="wrap">
        <h1 data-split>Catch the <em>moment</em> before it passes.</h1>
        <p className="lede">Aditya&apos;s weekly radar of ten founder podcasts: the topics everyone is covering, the guests on a media round right now, and the brands already buying podcast ads. You make every call. Nothing here ever contacts anyone.</p>
        {children}
      </div>
    </div>
  );
}
