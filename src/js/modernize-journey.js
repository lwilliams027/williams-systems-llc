/* =====================================================================
   Modernize an app: a before/after renovation.

   One app window with its old version and its rebuilt version stacked,
   and a before/after slider between them:
     1 Overview   the old app appears; the slider glides in to show half and half (plays on load)
     2 Before     all old: an hourglass, a crawling load bar, a run-time error
     3 After      the slider sweeps across to the rebuilt app: same data, same workflow
     4 Faster     a race: the old load crawls, the new one is done almost at once
     5 Fixed      the bugs are fixed one by one; the fix list ticks
     6 Anywhere   the app moves over for a tablet and a phone running it too
     7 Relaunch   v3.0, and the team is back online
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('modernizeJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.md-scene'), fit = $('.md-fit');
  const chaps = $$('.md-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 780 × 520 and scaled to fit ---------- */
  const W = 780, H = 520;
  const size = () => {
    const col = $('.md-side').clientWidth;
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

  const SMOOTH = 'sine.inOut', OUT = 'power2.out';
  const win = $('.md-win'), handle = $('.md-handle'), fresh = $('.md-new');

  // the slider: 100 = all old, 0 = all new
  const slider = { v: 100 };
  const paint = () => { handle.style.left = `${slider.v}%`; fresh.style.clipPath = `inset(0 0 0 ${slider.v}%)`; };
  paint();
  const slide = (t, v, at, dur) => t.to(slider, { v, duration: dur, ease: SMOOTH, onUpdate: paint }, at);
  const timeText = (t, el, to, at, dur) => {
    const p = { n: 0 };
    t.to(p, { n: to, duration: dur, ease: 'none', onUpdate: () => { el.textContent = `${p.n.toFixed(1)} s`; } }, at);
  };

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(win, { filter: 'brightness(1)' });

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

  /* ---------- 1 · the old app, then half and half (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(win, { autoAlpha: 0, y: 30, duration: 0.5, ease: 'power3.out' }, 0)
    .to(handle, { opacity: 1, duration: 0.2 }, 0.75);
  slide(intro, 55, 0.8, 0.7);

  /* ---------- every later chapter: new words ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
  }

  /* ---------- 2 · before: slow, dated, breaking ---------- */
  {
    const T = SCENE;
    slide(tl, 100, T - 0.4, 0.5);
    tl.to(handle, { opacity: 0, duration: 0.15 }, T + 0.05)
      .to($('.md-hourglass'), { opacity: 1, duration: 0.1 }, T + 0.1)
      .to($('.md-hourglass'), { rotation: 540, duration: 1.2, ease: 'none' }, T + 0.1)
      .fromTo($('.md-crawl i'), { scaleX: 0.05 }, { scaleX: 0.32, duration: 1.1, ease: 'none', immediateRender: false }, T + 0.1)
      .fromTo($('.md-err'), { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.15, ease: OUT, immediateRender: false }, T + 0.75);
  }

  /* ---------- 3 · after: sweep across to the rebuilt app ---------- */
  {
    const T = 2 * SCENE;
    tl.to([$('.md-err'), $('.md-hourglass')], { opacity: 0, duration: 0.2 }, T - 0.4)
      .to(handle, { opacity: 1, duration: 0.15 }, T - 0.3);
    slide(tl, 0, T - 0.1, 0.9);
    tl.to(handle, { opacity: 0, duration: 0.2 }, T + 0.85)
      .from($$('.md-same span'), { opacity: 0, y: 10, duration: 0.2, stagger: 0.08, ease: OUT }, T + 0.95);
  }

  /* ---------- 4 · faster: the race ---------- */
  {
    const T = 3 * SCENE, race = $('.md-race');
    tl.to(win, { filter: 'brightness(0.45)', duration: 0.3 }, T - 0.2)
      .fromTo(race, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3, ease: OUT, immediateRender: false }, T - 0.1)
      // the new one is done almost at once; the old one takes all chapter
      .to($('.md-track .new'), { scaleX: 1, duration: 0.12, ease: 'power1.out' }, T + 0.25)
      .to($('.md-track .old'), { scaleX: 1, duration: 1.0, ease: 'none' }, T + 0.25)
      .to($('.md-x'), { opacity: 1, duration: 0.2 }, T + 1.05)
      .to(race, { opacity: 0, duration: 0.2 }, 4 * SCENE - 0.45)
      .to(win, { filter: 'brightness(1)', duration: 0.3 }, 4 * SCENE - 0.4);
    timeText(tl, $('.md-t.new'), 0.8, T + 0.25, 0.12);
    timeText(tl, $('.md-t.old'), 8.4, T + 0.25, 1.0);
  }

  /* ---------- 5 · fixed and safer: the bugs are fixed ---------- */
  {
    const T = 4 * SCENE, bugs = $$('.md-bug'), fixes = $('.md-fixes');
    // the app steps back while the fix list is up, so the list isn't sitting on the rows
    tl.to(bugs, { opacity: 1, duration: 0.15, stagger: 0.05 }, T - 0.1)
      .to(win, { filter: 'brightness(0.45)', duration: 0.3 }, T + 0.25)
      .to(win, { filter: 'brightness(1)', duration: 0.3 }, 5 * SCENE - 0.45);
    bugs.forEach((b, k) => tl.to(b, { scale: 1.8, opacity: 0, duration: 0.15, ease: OUT }, T + 0.35 + k * 0.14));
    tl.fromTo(fixes, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.25, ease: OUT, immediateRender: false }, T + 0.3)
      .from($$('li', fixes), { opacity: 0, x: -10, duration: 0.15, stagger: 0.14, ease: OUT }, T + 0.4)
      .to(fixes, { opacity: 0, duration: 0.2 }, 5 * SCENE - 0.45);
  }

  /* ---------- 6 · anywhere: a tablet and a phone join ---------- */
  {
    const T = 5 * SCENE;
    tl.to(win, { scale: 0.5, duration: 0.7, ease: SMOOTH }, T - 0.4)
      .fromTo($('.md-tab'), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.5, ease: SMOOTH, immediateRender: false }, T - 0.1)
      .fromTo($('.md-phone'), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.5, ease: SMOOTH, immediateRender: false }, T + 0.1)
      .from($$('.md-tab .md-card, .md-phone .md-card'), { opacity: 0, y: 10, duration: 0.2, stagger: 0.05, ease: OUT }, T + 0.5);
  }

  /* ---------- 7 · relaunch ---------- */
  {
    const T = 6 * SCENE;
    tl.to($('.md-relaunch'), { opacity: 1, duration: 0.3, ease: OUT }, T + 0.2)
      .from($$('.md-online i'), { opacity: 0, duration: 0.15, stagger: 0.08 }, T + 0.45)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.md-stage'),
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
