/* =====================================================================
   Move to the cloud: moving day.

   A window onto a tall world: the old office closet at the bottom, the
   new cloud at the top. The camera travels up as the move happens, and
   the sky goes from evening to night to morning.
     1 Overview    the old server in its closet (plays on load)
     2 The move    the route draws itself from the closet up to the cloud
     3 The plan    a clipboard of agreed steps ticks off
     4 Safe copy   boxes ride the route; copied and verified counts climb
     5 Switch-over night; the lever flips from OLD to NEW; the old server goes dark; 0 min downtime
     6 After       morning; the monthly bill drops
     7 Moved       the cloud, in your name; the team signs in Monday
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('migrateJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const view = $('.mv-view'), fit = $('.mv-fit'), world = $('.mv-world');
  const chaps = $$('.mv-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- a 760 × 520 window, scaled to fit ---------- */
  const W = 760, H = 520;
  const size = () => {
    const col = $('.mv-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.66)) / H, 1.2);
    view.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  // the sky's night and morning layers
  const sky = $('.mv-sky');
  const night = document.createElement('i'), morning = document.createElement('i');
  night.className = 'mv-night'; morning.className = 'mv-morning';
  sky.prepend(morning); sky.prepend(night);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    gsap.set(world, { y: -780 });
    return;
  }

  /* ---------- helpers (reversible, for a scrubbed timeline) ---------- */
  const flag = (tl, el, name, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, p.v > 0.5) }, at);
  };
  const count = (tl, el, from, to, at, dur, f = (n) => Math.round(n).toLocaleString('en-US')) => {
    const v = { n: from };
    tl.to(v, { n: to, duration: dur, ease: 'power1.inOut', onUpdate: () => { el.textContent = f(v.n); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  // where the camera looks for each chapter (how far the world is moved up)
  const CAM = [-780, -540, -380, -400, -260, 0, 0];
  const route = $('.mv-route path'), routeD = route.getAttribute('d');
  const box = () => {
    const b = document.createElement('i');
    b.className = 'mv-box';
    b.style.offsetPath = `path('${routeD}')`;
    b.style.offsetDistance = '0%';
    b.style.opacity = '0';
    world.appendChild(b);
    return b;
  };

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(world, { y: CAM[0] });
  gsap.set(route, { drawSVG: '0%' });

  const SCENE = 1.8;
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'none' } }).timeScale(0.75);
  ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => gsap.delayedCall(0.3, () => intro.play()) });
  if (steps[0]) steps[0].classList.add('on');
  // the lit pill follows where the timeline is, in either scroll direction
  tl.eventCallback('onUpdate', () => {
    const i = Math.min(steps.length - 1, Math.floor(tl.time() / SCENE + 0.001));
    steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
  });

  /* ---------- 1 · the old closet (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(view, { autoAlpha: 0, y: 30, duration: 0.5, ease: 'power3.out' }, 0)
    .from($('.mv-tower'), { opacity: 0, y: 20, duration: 0.4, ease: OUT }, 0.35)
    .from($('.mv-note'), { opacity: 0, rotation: 30, duration: 0.3, ease: OUT }, 0.7)
    .from($$('.mv-cable'), { scaleX: 0, transformOrigin: '0 50%', duration: 0.3, stagger: 0.1, ease: OUT }, 0.6);

  /* ---------- every later chapter: new words, the camera travels ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    if (CAM[i] !== CAM[i - 1]) tl.to(world, { y: CAM[i], duration: 0.8, ease: SMOOTH }, T - 0.4);
  }
  const panel = (el, i, until = i + 1) => tl.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: OUT, immediateRender: false }, i * SCENE - 0.05)
    .to(el, { opacity: 0, duration: 0.25 }, until * SCENE - 0.45);

  /* ---------- 2 · the route from the closet to the cloud ---------- */
  {
    const T = SCENE, b = box();
    tl.to(route, { drawSVG: '100%', duration: 1.0, ease: SMOOTH }, T - 0.3)
      .to(b, { opacity: 1, duration: 0.05 }, T + 0.1)
      .to(b, { offsetDistance: '100%', duration: 1.1, ease: SMOOTH }, T + 0.1)
      .to(b, { opacity: 0, duration: 0.1 }, T + 1.15);
  }

  /* ---------- 3 · the plan ---------- */
  panel($('.mv-plan'), 2);
  $$('.mv-plan li').forEach((li, k) => flag(tl, li, 'done', 2 * SCENE + 0.35 + k * 0.18));

  /* ---------- 4 · safe copy: boxes ride up, counts climb ---------- */
  {
    const T = 3 * SCENE;
    panel($('.mv-copied'), 3);
    for (let k = 0; k < 8; k++) {
      const b = box(), at = T + 0.05 + k * 0.12;
      tl.to(b, { opacity: 1, duration: 0.05 }, at)
        .to(b, { offsetDistance: '100%', duration: 0.7, ease: SMOOTH }, at)
        .to(b, { opacity: 0, duration: 0.08 }, at + 0.66);
    }
    count(tl, $('.mv-c1'), 0, 12480, T + 0.1, 0.9);
    count(tl, $('.mv-c2'), 0, 12480, T + 0.25, 0.95);
  }

  /* ---------- 5 · switch-over at night ---------- */
  {
    const T = 4 * SCENE, clock = $('.mv-clock');
    tl.to(night, { opacity: 0.92, duration: 0.5 }, T - 0.4)
      .to([$('.mv-stars'), $('.mv-moon')], { opacity: 1, duration: 0.5 }, T - 0.3);
    panel($('.mv-switch'), 4);
    count(tl, clock, 0, 40, T + 0.2, 0.9, (n) => `2:${String(Math.round(n)).padStart(2, '0')} AM`);
    tl.to($('.mv-handle'), { x: 94, duration: 0.25, ease: SMOOTH }, T + 0.6);
    flag(tl, $('.mv-handle'), 'new', T + 0.7);
    flag(tl, $('.mv-tower'), 'off', T + 0.72);
    flag(tl, $('.mv-rack'), 'on', T + 0.72);
    tl.from($('.mv-down'), { opacity: 0, y: 8, duration: 0.2, ease: OUT }, T + 0.8);
  }

  /* ---------- 6 · morning: a smaller bill ---------- */
  {
    const T = 5 * SCENE;
    tl.to([night, $('.mv-stars'), $('.mv-moon')], { opacity: 0, duration: 0.5 }, T - 0.4)
      .to(morning, { opacity: 0.85, duration: 0.5 }, T - 0.4)
      .fromTo($('.mv-sun'), { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: OUT, immediateRender: false }, T - 0.3)
      .fromTo($('.mv-bill'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: OUT, immediateRender: false }, T + 0.1);
    count(tl, $('.mv-cost'), 890, 520, T + 0.45, 0.6, (n) => `$${Math.round(n)}`);
  }

  /* ---------- 7 · moved: yours, and the team is in ---------- */
  {
    const T = 6 * SCENE;
    tl.to($('.mv-own'), { opacity: 1, duration: 0.25 }, T + 0.15)
      .fromTo($('.mv-team'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: OUT, immediateRender: false }, T + 0.35)
      .from($$('.mv-faces i'), { opacity: 0, x: -8, duration: 0.12, stagger: 0.08 }, T + 0.5)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.mv-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  // the chapter pills are buttons: each scrolls to its chapter, once it has played out
  chapterNav(section, tl, (i) => i * SCENE + 1.25);
  if (import.meta.env.DEV) window.__flip = tl;
}
