'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// A Back control that lives in the top bar, so it is always on screen.
// With an href it goes to that page. Without one (the dashboard) it appears once you have opened more than one block,
// and steps back to the block you came from.
export function BackButton({ href, label = 'Back' }) {
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (href) return undefined;
    const onTrail = (e) => setDepth(e.detail?.depth || 0);
    window.addEventListener('block-trail', onTrail);
    return () => window.removeEventListener('block-trail', onTrail);
  }, [href]);

  if (href) {
    return <Link className="backbtn" href={href} aria-label={`Back to ${label}`}><span aria-hidden="true">←</span><span className="backbtn-t"> {label}</span></Link>;
  }
  if (depth < 1) return null;
  return (
    <button type="button" className="backbtn" onClick={() => window.history.back()} aria-label="Back to the previous block">
      <span aria-hidden="true">←</span><span className="backbtn-t"> Back</span>
    </button>
  );
}
