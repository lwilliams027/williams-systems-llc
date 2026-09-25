/* =====================================================================
   Website tour (websites.html)

   A real client site (Face & Mane), one screen at a time. The section is
   pinned while you scroll; each step swaps the recording playing in a
   floating browser window (the live site's own animations, a hover, a
   click, a drag), with a modern transition between them: the old screen
   blurs and falls back, the new one opens from a rounded mask, and the
   window tilts gently in 3D. At the end a phone joins with the mobile site.

   Only the clip on screen plays; each clip loads just before it's needed.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('tour');
if (section) initTour();

function initTour() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('.tour-stage');
  const browser = $('.tour-browser');
  const glow = $('.tour-glow');
  const phone = $('.tour-phone');
  const phoneVid = $('.tour-clip-phone');
  const clips = Object.fromEntries($$('.tour-clip').map((v) => [v.dataset.clip, v]));
  const caps = $$('.tour-cap');
  const dots = $$('.tour-dots li');
  const live = $('.tw-live');
  const N = caps.length;

  const load = (v) => {
    if (v && v.dataset.src && !v.getAttribute('src')) {
      v.src = import.meta.env.BASE_URL + v.dataset.src.replace(/^\//, '');
      v.preload = 'auto';
    }
  };

  // Reduced motion: the first screen as a still picture, and every caption.
  if (reduced) {
    section.classList.add('is-static');
    gsap.set(live, { opacity: 1 });
    return;
  }

  /* -------------------------------------------------- which clip plays */
  let active = -1;
  let inView = false;
  const playActive = () => {
    const i = Math.max(0, active);
    const want = caps[i].dataset.clip;
    Object.entries(clips).forEach(([k, v]) => {
      if (inView && k === want) { load(v); v.play().catch(() => {}); } else v.pause();
    });
    if (inView && caps[i].hasAttribute('data-phone')) { load(phoneVid); phoneVid.play().catch(() => {}); } else phoneVid.pause();
  };
  const setStop = (i) => {
    if (i === active) return;
    const prevClip = caps[active]?.dataset.clip;
    active = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    const clip = clips[caps[i].dataset.clip];
    if (clip && caps[i].dataset.clip !== prevClip) { load(clip); try { clip.currentTime = 0; } catch { /* not loaded yet */ } }
    const next = caps[i + 1];                         // warm up the next clip
    if (next) load(next.hasAttribute('data-phone') ? phoneVid : clips[next.dataset.clip]);
    playActive();
  };

  /* -------------------------------------------------- scroll timeline */
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => setStop(Math.min(N - 1, Math.max(0, Math.floor(tl.time() + 0.12)))),
  });

  // The window holds still; a camera works inside it. Each stop's data-cam is
  // "originX originY startScale endScale": the camera eases from start to end
  // across the stop (e.g. close on "Book Now", pulling back as the page opens).
  const cam = (i) => { const [ox, oy, s0, s1] = caps[i].dataset.cam.split(' ').map(Number); return { origin: `${ox}% ${oy}%`, s0, s1 }; };
  const screenOf = (i) => clips[caps[i].dataset.clip];
  gsap.set(Object.values(clips), { transformOrigin: '50% 50%' });

  // Intro: the window rises in, straight on.
  tl.fromTo(browser, { y: 60, scale: 0.94, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power3.out' }, 0)
    .fromTo(caps[0], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power3.out' }, 0.05);

  for (let i = 0; i < N; i++) {
    const at = i, c = cam(i), el = screenOf(i);
    // the camera move for this stop
    tl.fromTo(el, { scale: c.s0, transformOrigin: c.origin }, { scale: c.s1, transformOrigin: c.origin, duration: 0.95, ease: 'power1.inOut', immediateRender: i === 0 }, at);
    if (i === 0) continue;
    const prev = screenOf(i - 1);
    // captions
    tl.to(caps[i - 1], { autoAlpha: 0, y: -24, duration: 0.12, ease: 'power2.in' }, at - 0.16)
      .fromTo(caps[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power3.out' }, at);
    // zoom-through: the old screen keeps pushing in as it fades; the new one arrives from a step back
    if (prev !== el) {
      tl.to(prev, { scale: `+=${0.25}`, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, at - 0.1)
        .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.14, ease: 'power1.out', immediateRender: false }, at - 0.02);
    }
  }

  // Last step: the window slides aside and a phone rises in beside it.
  const last = N - 1;
  tl.to(browser, { x: () => -browser.offsetWidth * 0.07, scale: 0.9, duration: 0.4, ease: 'power2.inOut' }, last - 0.25)
    .fromTo(phone, { autoAlpha: 0, y: 120 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, last - 0.1)
    .fromTo(live, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)' }, last + 0.15)
    .to({}, { duration: 0.6 }, last + 0.25);           // hold on the finished picture

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * N * 1.1,
    pin: stage,
    scrub: 0.7,
    animation: tl,
    invalidateOnRefresh: true,
  });
  // Play only while the tour is on screen.
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { inView = self.isActive; if (active < 0) setStop(0); else playActive(); },
  });

  if (import.meta.env.DEV) window.__tour = tl;   // for tuning in the console
}
