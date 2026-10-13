'use client';
import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, SplitText } from '@/lib/gsap';

// Page-wide motion. The page is fully server-rendered and readable without JavaScript;
// everything here only enhances it after hydration. Animates transform, opacity and SVG stroke only
// (plus a cursor-follow glow that changes a CSS variable). Nothing is pinned: this is a work tool.
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
          const q = gsap.utils.selector(root.current);
          const cleanups = [];
          const stagger = desktop ? 0.08 : 0.05;

          const countUp = (el, delay = 0) => {
            const to = parseFloat(el.dataset.count);
            if (Number.isNaN(to)) return;
            const dec = parseInt(el.dataset.dec || '0', 10);
            const suffix = el.dataset.suffix || '';
            const o = { v: 0 };
            // If the effect is torn down mid-count (React dev double-mount, route change), put the real number back.
            cleanups.push(() => (el.textContent = `${to.toFixed(dec)}${suffix}`));
            el.textContent = `${(0).toFixed(dec)}${suffix}`;
            gsap.to(o, { v: to, duration: 1.1, delay, ease: 'power2.out', onUpdate: () => (el.textContent = `${o.v.toFixed(dec)}${suffix}`), onComplete: () => (el.textContent = `${to.toFixed(dec)}${suffix}`) });
          };

          // everything that belongs to one list item animates when the item scrolls into view
          const playItem = (el) => {
            el.querySelectorAll('[data-count]').forEach((c) => countUp(c, 0.15));
            const bar = el.querySelector('[data-bar]');
            if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.9, delay: 0.2, ease: 'power3.out', transformOrigin: 'left center' });
            const dots = el.querySelectorAll('[data-dot]');
            if (dots.length) gsap.from(dots, { scale: 0, opacity: 0, duration: 0.4, stagger: 0.035, delay: 0.25, ease: 'back.out(2.5)' });
            const ring = el.querySelector('[data-ringfg]');
            if (ring) gsap.fromTo(ring, { strokeDashoffset: parseFloat(ring.dataset.circ) }, { strokeDashoffset: parseFloat(ring.dataset.target), duration: 1.2, delay: 0.2, ease: 'power3.out' });
            const spark = el.querySelector('[data-spark]');
            if (spark?.getTotalLength) {
              const len = spark.getTotalLength();
              gsap.fromTo(spark, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1, delay: 0.3, ease: 'power2.out' });
            }
          };

          // ---- intro (once; not replayed when data revalidates) ----
          if (!played.current) {
            played.current = true;
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            const rings = q('[data-ring]');
            rings.forEach((c) => {
              const len = c.getTotalLength ? c.getTotalLength() : 0;
              if (len) gsap.set(c, { strokeDasharray: len, strokeDashoffset: len });
            });
            tl.to(rings, { strokeDashoffset: 0, duration: 1.2, stagger: 0.09 }, 0);
            tl.from(q('.axis'), { opacity: 0, duration: 0.9 }, 0.3);
            tl.from(q('[data-blip]'), { scale: 0, opacity: 0, duration: 0.8, stagger: 0.11, ease: 'back.out(2.2)' }, 0.8);
            tl.from(q('.eyebrow'), { y: 14, opacity: 0, duration: 0.6 }, 0.1);
            const h1 = q('[data-split]')[0];
            if (h1) {
              SplitText.create(h1, {
                type: 'lines',
                mask: 'lines',
                autoSplit: true,
                onSplit: (self) => tl.from(self.lines, { yPercent: 115, duration: 0.95, stagger: 0.12 }, 0.2),
              });
            }
            tl.from(q('[data-banner]'), { y: -16, opacity: 0, duration: 0.6 }, 0.75);
            tl.from(q('[data-stat]'), { y: 26, opacity: 0, duration: 0.65, stagger: 0.09 }, 0.9);
            q('[data-stat] [data-count]').forEach((c, i) => countUp(c, 1 + i * 0.09));
          }

          // ---- scroll reveals ----
          const batchIn = (selector, from) => {
            const items = q(selector);
            if (!items.length) return;
            gsap.set(items, { opacity: 0, ...from });
            ScrollTrigger.batch(items, {
              start: 'top 92%',
              once: true,
              onEnter: (batch) => {
                gsap.to(batch, { opacity: 1, x: 0, y: 0, duration: 0.8, stagger, ease: 'power3.out', overwrite: true });
                batch.forEach(playItem);
              },
            });
          };
          batchIn('.topic', { y: 36 });
          batchIn('.fcard', { y: 48 });
          batchIn('.srow', { y: 32 });

          // section titles rise in
          q('.sec-head h2, .sec-head .sec-sub').forEach((el) => {
            gsap.from(el, { y: 36, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
          });
          const method = q('#method .sec-head, #method details');
          gsap.set(method, { opacity: 0, y: 20 });
          ScrollTrigger.batch(method, { start: 'top 92%', once: true, onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }) });

          // progress rail and a radar sweep tied to the scroll position
          const rail = document.querySelector('[data-progress]');
          if (rail) gsap.to(rail, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });
          gsap.to(q('[data-sweep]'), { rotation: 240, svgOrigin: '260 260', ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1 } });

          // cursor-follow glow on founder cards (desktop pointers only)
          if (desktop) {
            q('.fcard').forEach((card) => {
              const move = (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
              };
              card.addEventListener('pointermove', move);
              cleanups.push(() => card.removeEventListener('pointermove', move));
            });
          }

          // collapsible method: fade and slide the content in on open
          const det = q('[data-method]')[0];
          const body = q('[data-method-body]')[0];
          if (det && body) {
            const onToggle = contextSafe(() => {
              if (det.open) gsap.fromTo(body, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', onComplete: () => ScrollTrigger.refresh() });
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
          if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
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
