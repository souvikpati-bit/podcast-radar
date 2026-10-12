'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// A row of clickable blocks. Only the panel of the selected block is shown, so a page never dumps everything at once.
// The selected block is kept in the address (#topics, #guests ...) so links and the top bar can jump straight to one.
export function BlockTabs({ tabs, initial, label = 'Sections', bare = false }) {
  const key = tabs.map((t) => t.id).join('|');
  const ids = useMemo(() => key.split('|'), [key]);
  const [active, setActive] = useState(initial || ids[0]);
  const top = useRef(null);
  const userMoved = useRef(false);

  const select = useCallback((id, fromUser = true) => {
    if (!ids.includes(id)) return;
    userMoved.current = fromUser;
    setActive(id);
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      /* address bar not available: the block still switches */
    }
  }, [ids]);

  // Open the block named in the address, and follow later changes (back button, top-bar links).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (ids.includes(h)) {
        userMoved.current = true;
        setActive(h);
      }
    };
    fromHash();
    const onClick = (e) => {
      const a = e.target.closest?.('a[href*="#"]');
      if (!a) return;
      try {
        const u = new URL(a.href, window.location.href);
        const h = u.hash.replace('#', '');
        if (u.pathname === window.location.pathname && ids.includes(h)) {
          e.preventDefault();
          select(h);
        }
      } catch {
        /* ignore odd links */
      }
    };
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('popstate', fromHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      window.removeEventListener('popstate', fromHash);
      document.removeEventListener('click', onClick);
    };
  }, [ids, select]);

  // After the user picks a block, bring the block row to the top of the screen so the panel is right below it.
  useEffect(() => {
    if (!userMoved.current || !top.current) return;
    const y = top.current.getBoundingClientRect().top;
    if (y < 0 || y > 240) top.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [active]);

  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
    select(ids[next]);
    document.getElementById(`tab-${ids[next]}`)?.focus();
  };

  return (
    <div className={bare ? undefined : 'wrap'}>
      <div ref={top} className="blocks-anchor" />
      <div className="blocks" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            className="block-btn"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="bb-num mono">{t.num || String(i + 1).padStart(2, '0')}</span>
            <span className="bb-label">{t.label}</span>
            {t.hint && <span className="bb-hint">{t.hint}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} className="block-panel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
