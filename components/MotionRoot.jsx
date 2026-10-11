'use client';
import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, SplitText } from '@/lib/gsap';

// Page-wide motion. The page is fully server-rendered and readable without JavaScript;
// everything here only enhances it after hydration. Animates transform, opacity and SVG stroke only.
export function MotionRoot({ children }) {
  const root = useRef(null);
  const played = useRef(false);

  useGSAP(
    (context, contextSafe) => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
          mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
        },
        (ctx) => {
          const { reduce, desktop } = ctx.conditions;
          if (reduce) return; // everything stays visible and still
          const cleanups = [];
          const q = gsap.utils.selector(root.current);
          const stagger = desktop ? 0.07 : 0.04;

          // ---- intro (once; not replayed when data revalidates) ----
          if (!played.current) {
            played.current = true;
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            const rings = q('[data-ring]');
            rings.forEach((c) => {
              const len = c.getTotalLength ? c.getTotalLength() : 0;
              if (len) gsap.set(c, { strokeDasharray: len, strokeDashoffset: len });
            });
            tl.to(rings, { strokeDashoffset: 0, duration: 1, stagger: 0.08 }, 0);
            const h1 = q('[data-split]')[0];
            if (h1) {
              SplitText.create(h1, {
                type: 'lines',
                mask: 'lines',
                autoSplit: true,
                onSplit: (self) => tl.from(self.lines, { yPercent: 110, duration: 0.8, stagger: 0.1 }, 0.05),
              });
            }
            tl.from(q('.lede'), { y: 14, opacity: 0, duration: 0.6 }, 0.35);
            tl.from(q('[data-banner]'), { y: -18, opacity: 0, duration: 0.55 }, 0.5);
            const counters = q('[data-count]');
            counters.forEach((el) => {
              const to = parseFloat(el.dataset.count);
              const dec = parseInt(el.dataset.dec || '0', 10);
              const suffix = el.dataset.suffix || '';
              const o = { v: 0 };
              el.textContent = `${(0).toFixed(dec)}${suffix}`;
              tl.to(o, { v: to, duration: 0.9, onUpdate: () => (el.textContent = `${o.v.toFixed(dec)}${suffix}`) }, 0.45);
            });
            tl.from(q('#topics [data-row]'), { opacity: 0, y: 18, duration: 0.5, stagger }, 0.5);
            tl.from(q('#topics [data-bar]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.8, stagger }, 0.6);
          }

          // ---- scroll reveals for the lower sections ----
          const lower = q('#guests [data-row], #sponsors [data-row]');
          gsap.set(lower, { opacity: 0, y: 22 });
          ScrollTrigger.batch(lower, {
            start: 'top 92%',
            once: true,
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.55, stagger, ease: 'power2.out', overwrite: true }),
          });
          const lowerBars = q('#guests [data-bar], #sponsors [data-bar]');
          gsap.set(lowerBars, { scaleX: 0, transformOrigin: 'left center' });
          ScrollTrigger.batch(lowerBars, { start: 'top 95%', once: true, onEnter: (b) => gsap.to(b, { scaleX: 1, duration: 0.7, stagger, ease: 'power2.out' }) });
          const method = q('#method .sec-head, #method details');
          gsap.set(method, { opacity: 0, y: 18 });
          ScrollTrigger.batch(method, { start: 'top 92%', once: true, onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }) });

          // slight section-numeral scrub and the progress rail
          q('.sec-num').forEach((n) => {
            gsap.fromTo(n, { y: 10 }, { y: -10, ease: 'none', scrollTrigger: { trigger: n.closest('section') || n, start: 'top bottom', end: 'bottom top', scrub: true } });
          });
          const rail = document.querySelector('[data-progress]');
          if (rail) gsap.to(rail, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

          // collapsible method: fade and slide the content in on open
          const det = q('[data-method]')[0];
          const body = q('[data-method-body]')[0];
          if (det && body) {
            const onToggle = contextSafe(() => {
              if (det.open) gsap.fromTo(body, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', onComplete: () => ScrollTrigger.refresh() });
              else ScrollTrigger.refresh();
            });
            det.addEventListener('toggle', onToggle);
            cleanups.push(() => det.removeEventListener('toggle', onToggle));
          }

          // magnetic primary buttons (desktop only)
          if (desktop) {
            q('.btn:not(.ghost)').forEach((btn) => {
              const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
              const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
              const move = (e) => {
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.25);
              };
              const leave = () => {
                xTo(0);
                yTo(0);
              };
              btn.addEventListener('mousemove', move);
              btn.addEventListener('mouseleave', leave);
              cleanups.push(() => {
                btn.removeEventListener('mousemove', move);
                btn.removeEventListener('mouseleave', leave);
              });
            });
          }
          requestAnimationFrame(() => ScrollTrigger.refresh());
          return () => cleanups.forEach((fn) => fn());
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
