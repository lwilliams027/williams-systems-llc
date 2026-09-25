/* =====================================================================
   About us: the same desk through the years.

   One desk under a lamp; a split-flap sign on the wall names the era,
   and what's on the desk and wall changes with it:
     1 Who we are  today's desk: the Williams Systems monitor, the map, the notes (plays on load)
     2 Age 10      a retro computer types HELLO, WORLD
     3 Self-taught a laptop full of code, a stack of books, project notes
     4 Freelance   a cork board of client projects, each stamped LAUNCHED
     5 Medical     a heartbeat line and a checklist that ticks
     6 Today       back to today: Michigan reaches the world; Landon's card
   Pinned, scrubbed by scroll; eras crossfade, nothing bounces.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { chapterNav } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, DrawSVGPlugin);

const section = document.getElementById('aboutJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.ab-scene'), fit = $('.ab-fit');
  const chaps = $$('.ab-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 780 × 520 and scaled to fit ---------- */
  const W = 780, H = 520;
  const size = () => {
    const col = $('.ab-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.66)) / H, 1.2);
    scene.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    return;
  }

  /* ---------- helpers (reversible, for a scrubbed timeline) ---------- */
  const flag = (tl, el, name, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, p.v > 0.5) }, at);
  };
  const type = (tl, el, at, dur) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  const era = (e) => $(`.ab-era-g[data-e="${e}"]`);
  const ERAS = ['today', 'ten', 'self', 'free', 'med', 'today'];
  const SIGN = ['TODAY', 'AGE 10', 'SELF-TAUGHT', 'FREELANCE', 'MEDICAL', 'TODAY'];
  const sign = $('.ab-era');

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set($$('.ab-era-g'), { autoAlpha: 0 });
  gsap.set(era('today'), { autoAlpha: 1 });
  gsap.set($('.ab-ecg'), { drawSVG: '0%' });

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

  /* ---------- 1 · today's desk (plays on load) ---------- */
  const today = era('today');
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(scene, { autoAlpha: 0, y: 30, duration: 0.5, ease: 'power3.out' }, 0)
    .from($('.ab-monitor', today), { opacity: 0, y: 20, duration: 0.4, ease: OUT }, 0.3)
    .from($$('.ab-mark path', today), { opacity: 0, duration: 0.2, stagger: 0.08 }, 0.55)
    .from($('.ab-map', today), { opacity: 0, x: 20, duration: 0.35, ease: OUT }, 0.5)
    .from($$('.ab-notes span', today), { opacity: 0, x: -14, duration: 0.2, stagger: 0.1, ease: OUT }, 0.7)
    .from($('.ab-plant', today), { opacity: 0, duration: 0.3 }, 0.8);

  /* ---------- every later chapter: the sign flips, the desk changes era ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1)
      .to(sign, { scrambleText: { text: SIGN[i], chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', speed: 0.6 }, duration: 0.45 }, T - 0.3)
      .fromTo(era(ERAS[i - 1]), { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 0.97, duration: 0.35, ease: SMOOTH, immediateRender: false }, T - 0.4)
      .fromTo(era(ERAS[i]), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: SMOOTH, immediateRender: false }, T - 0.15);
  }

  /* ---------- 2 · age 10 ---------- */
  {
    const T = SCENE, g = era('ten');
    $$('.ab-line', g).forEach((l, k) => type(tl, l, T + 0.2 + k * 0.22, 0.2));
    tl.from($('.ab-hello', g), { opacity: 0, duration: 0.15 }, T + 0.9)
      .from($$('.ab-floppy', g), { opacity: 0, y: 12, duration: 0.2, stagger: 0.1, ease: OUT }, T + 0.3)
      .from($('.ab-crayon', g), { opacity: 0, duration: 0.25 }, T + 1.0);
  }

  /* ---------- 3 · self-taught ---------- */
  {
    const T = 2 * SCENE, g = era('self');
    tl.from($$('.ab-lap-scr p', g), { scaleX: 0, transformOrigin: '0 50%', duration: 0.2, stagger: 0.08, ease: OUT }, T + 0.2)
      .from($$('.ab-books b', g), { opacity: 0, y: -30, duration: 0.25, stagger: 0.1, ease: OUT }, T + 0.3)
      .from($$('.ab-pins span', g), { opacity: 0, scale: 0.85, duration: 0.2, stagger: 0.08, ease: OUT }, T + 0.55);
  }

  /* ---------- 4 · freelance: every project stamped LAUNCHED ---------- */
  {
    const T = 3 * SCENE, g = era('free');
    tl.from($$('.ab-cork div', g), { opacity: 0, y: 12, duration: 0.2, stagger: 0.08, ease: OUT }, T + 0.2)
      .from($$('.ab-cork em', g), { opacity: 0, scale: 1.8, duration: 0.14, stagger: 0.12, ease: 'power3.in' }, T + 0.6)
      .from($$('.ab-lap-scr.site i', g), { opacity: 0, y: 8, duration: 0.15, stagger: 0.06 }, T + 0.3)
      .from([$('.ab-phone', g), $('.ab-mug', g)], { opacity: 0, duration: 0.25, stagger: 0.1 }, T + 0.4);
  }

  /* ---------- 5 · medical: the heartbeat and the checklist ---------- */
  {
    const T = 4 * SCENE, g = era('med');
    tl.to($('.ab-ecg', g), { drawSVG: '100%', duration: 0.7, ease: 'power1.inOut' }, T + 0.25);
    $$('.ab-checks li', g).forEach((li, k) => flag(tl, li, 'done', T + 0.6 + k * 0.18));
  }

  /* ---------- 6 · today: Michigan reaches the world; Landon ---------- */
  {
    const T = 5 * SCENE;
    tl.fromTo($$('.ab-reach'), { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.15, stagger: 0.08, ease: OUT, immediateRender: false }, T + 0.3)
      .fromTo($('.ab-founder'), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: OUT, immediateRender: false }, T + 0.6)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.ab-stage'),
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
