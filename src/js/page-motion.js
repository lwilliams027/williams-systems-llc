/* =====================================================================
   Page motion: scroll animations for the standard pages (About,
   Schedule and the product pages). Every piece of information animates
   in as it reaches the screen, so the page tells its story in order.
   Runs only on <body class="page">; skipped for reduced motion.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const EASE = 'power3.out';

/** A heading wipes up out of a mask while it rises into place. */
const wipeIn = (el) => ({
  targets: el,
  from: { clipPath: 'inset(0% 0% 100% 0%)', y: 48 },
  to: { clipPath: 'inset(0% 0% -20% 0%)', y: 0, duration: 1, ease: 'power4.out', clearProps: 'clipPath' },
});

/** Scroll-triggered timeline that plays once when `trigger` reaches `start`. */
const onEnter = (trigger, start = 'top 80%') =>
  gsap.timeline({ scrollTrigger: { trigger, start, once: true } });

function hero() {
  const h = document.querySelector('.pg-hero');
  if (!h) return;
  const title = h.querySelector('.pg-title');
  const tl = gsap.timeline({ delay: 0.1 });
  tl.from(h.querySelector('.scene-eyebrow'), { y: 16, autoAlpha: 0, duration: 0.6, ease: EASE });
  if (title) { const w = wipeIn(title); tl.fromTo(w.targets, w.from, w.to, '-=0.35'); }
  tl.from($$('.pg-lede, .pg-actions > *', h), { y: 26, autoAlpha: 0, duration: 0.7, ease: EASE, stagger: 0.09 }, '-=0.55');
  // A soft light drifts across the hero background.
  gsap.fromTo(h, { backgroundPosition: '0% 0%' }, { backgroundPosition: '0% 60%', ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
}

function sectionHeads() {
  $$('.pg-section:not(.pg-cta)').forEach((sec) => {
    const eyebrow = sec.querySelector(':scope .container > .scene-eyebrow, :scope .container > div > .scene-eyebrow');
    const head = sec.querySelector('.pg-h2');
    const paras = $$(':scope .container > .pg-p, :scope .container > div > .pg-p, :scope .container > .pg-actions, :scope .container > div > .pg-actions', sec);
    const tl = onEnter(sec, 'top 78%');
    if (eyebrow) tl.from(eyebrow, { y: 14, autoAlpha: 0, duration: 0.5, ease: EASE });
    if (head) { const w = wipeIn(head); tl.fromTo(w.targets, w.from, w.to, '-=0.25'); }
    if (paras.length) tl.from(paras, { y: 22, autoAlpha: 0, duration: 0.7, ease: EASE, stagger: 0.08 }, '-=0.6');
  });
}

/** Cards and list items: staggered rise, each group when it reaches the screen. */
function groups() {
  const rise = (selector, vars = {}) => $$(selector).forEach((group) => {
    const items = Array.from(group.children);
    if (!items.length) return;
    onEnter(group, 'top 85%').from(items, { y: 44, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: 0.09, ...vars });
  });
  rise('.pd-features', { scale: 0.96, stagger: { each: 0.08, grid: 'auto', from: 'start' } });
  rise('.pg-cards', { x: 40, y: 0 });
  rise('.pg-principles');
  rise('.ws-promises', { y: 56, scale: 0.97 });
  rise('.faq-list', { y: 24, duration: 0.6, stagger: 0.07 });
  rise('.pd-others', { y: 28, duration: 0.6, stagger: 0.06 });
  rise('.sched', { y: 30, duration: 0.7, stagger: 0.1 });
  // Pills pop in one after another.
  $$('.pg-section .one-team-points').forEach((ul) => {
    onEnter(ul, 'top 90%').from(ul.children, { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.05 });
  });
}

/** Websites "How it works": the line draws with the scroll and each step lights up as it reaches it. */
function flow() {
  const flowEl = document.querySelector('.ws-flow');
  if (!flowEl) return;
  const steps = Array.from(flowEl.children);
  gsap.set(flowEl, { '--line': 0 });
  gsap.set(steps, { autoAlpha: 0.12, y: 24 });
  const tl = gsap.timeline({ scrollTrigger: { trigger: flowEl, start: 'top 82%', end: 'bottom 60%', scrub: 0.6 } });
  tl.to(flowEl, { '--line': 1, duration: 1, ease: 'none' }, 0);
  steps.forEach((li, i) => {
    tl.to(li, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, (i / steps.length) * 0.85);
  });
}

/** Closing call to action: the big line scales up into place. */
function cta() {
  $$('.pg-cta').forEach((sec) => {
    const tl = onEnter(sec, 'top 80%');
    tl.from(sec.querySelector('.pg-h2'), { scale: 0.86, autoAlpha: 0, duration: 0.9, ease: 'power4.out' })
      .from($$('.pg-p, .pg-actions > *', sec), { y: 20, autoAlpha: 0, duration: 0.6, ease: EASE, stagger: 0.08 }, '-=0.5');
  });
}

export function initPageMotion({ reduced } = {}) {
  if (!document.body.classList.contains('page') || reduced) return;
  hero();
  sectionHeads();   // the closing call to action is left to cta(), which scales it in instead
  groups();
  flow();
  cta();
  ScrollTrigger.refresh();
}
