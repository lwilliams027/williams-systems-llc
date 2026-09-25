/* =====================================================================
   Ongoing support: a year of being looked after.

   A year of months runs along the top; the marker moves on as you scroll,
   and each chapter drifts in from the right as time passes:
     1 Overview    January: the support plan is active (plays on load)
     2 Just ask    a request is typed and sent
     3 Handled     the request crosses the board: to do, in progress, done
     4 Current     the changelog: three releases
     5 Watched     30 days of uptime; a slow night caught and fixed
     6 Same team   a question answered by the person who built the app
     7 Long term   December: the year's totals, and on to year two
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('supportJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.sp-scene'), fit = $('.sp-fit');
  const chaps = $$('.sp-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 780 × 520 and scaled to fit ---------- */
  const W = 780, H = 520;
  const size = () => {
    const col = $('.sp-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.66)) / H, 1.2);
    scene.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  // 30 days of uptime, one slow night among them
  const days = $('.sp-days');
  for (let k = 0; k < 30; k++) { const d = document.createElement('i'); if (k === 21) d.className = 'warn'; days.appendChild(d); }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    return;
  }

  /* ---------- helpers (reversible, for a scrubbed timeline) ---------- */
  const swap = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };
  const flag = (tl, el, name, at, on = true) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, on ? p.v > 0.5 : p.v < 0.5) }, at);
  };
  const type = (tl, el, at, dur) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  /* ---------- the year: the marker, and which months are behind us ---------- */
  const mark = $('.sp-mark'), months = $$('.sp-year span');
  const slot = (740 - 8) / 12;
  const MONTH = [0, 1, 3, 5, 8, 10, 11];                                // the month each chapter lands on
  const paintYear = () => {
    const now = Math.round((gsap.getProperty(mark, 'x') || 0) / slot);
    months.forEach((m, k) => { m.classList.toggle('past', k < now); m.classList.toggle('now', k === now); });
  };

  /* ---------- starting state ---------- */
  const groups = [$('.sp-start'), $('.sp-ask'), $('.sp-board'), $('.sp-log'), $('.sp-watch'), $('.sp-chat'), $('.sp-sum')];
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(mark, { x: 0 });
  paintYear();

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

  /* ---------- 1 · January: the plan is active (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from($('.sp-year'), { opacity: 0, y: -12, duration: 0.4, ease: OUT }, 0)
    .fromTo(groups[0], { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.5, ease: OUT }, 0.3)
    .from($('.sp-app'), { opacity: 0, y: 10, duration: 0.3, ease: OUT }, 0.8);

  /* ---------- every later chapter: time moves on, the next thing drifts in ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1)
      .to(mark, { x: MONTH[i] * slot, duration: 0.7, ease: SMOOTH, onUpdate: paintYear }, T - 0.4)
      .fromTo(groups[i - 1], { opacity: 1, x: 0 }, { opacity: 0, x: -40, duration: 0.3, ease: SMOOTH, immediateRender: false }, T - 0.45)
      .fromTo(groups[i], { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4, ease: SMOOTH, immediateRender: false }, T - 0.05);
  }

  /* ---------- 2 · just ask ---------- */
  {
    const T = SCENE;
    type(tl, $('.sp-ask .sp-typed'), T + 0.3, 0.45);
    tl.fromTo($('.sp-send'), { scale: 1 }, { keyframes: { scale: [1, 0.93, 1] }, duration: 0.12, immediateRender: false }, T + 0.85)
      .to($('.sp-got'), { opacity: 1, duration: 0.2 }, T + 0.95);
  }

  /* ---------- 3 · handled: across the board ---------- */
  {
    const T = 2 * SCENE, card = $('.sp-card'), st = $('.sp-state');
    tl.to(card, { x: 255, duration: 0.35, ease: SMOOTH }, T + 0.4);
    swap(tl, st, 'To do', 'In progress', T + 0.6);
    flag(tl, st, 'prog', T + 0.6);
    tl.to(card, { x: 510, duration: 0.35, ease: SMOOTH }, T + 0.95);
    swap(tl, st, 'In progress', 'Done ✓', T + 1.15);
    flag(tl, st, 'prog', T + 1.15, false);
    flag(tl, st, 'done', T + 1.15);
  }

  /* ---------- 4 · kept current: the changelog ---------- */
  tl.from($$('.sp-rel'), { opacity: 0, y: -20, duration: 0.25, stagger: 0.15, ease: OUT }, 3 * SCENE + 0.1);

  /* ---------- 5 · watched ---------- */
  {
    const T = 4 * SCENE;
    tl.from($$('.sp-days i'), { scaleY: 0, duration: 0.2, stagger: 0.015, ease: OUT }, T + 0.1)
      .from($('.sp-catch'), { opacity: 0, y: 12, duration: 0.25, ease: OUT }, T + 0.75);
  }

  /* ---------- 6 · a direct line to the builder ---------- */
  {
    const T = 5 * SCENE;
    tl.from($('.sp-msg.them'), { opacity: 0, x: -20, duration: 0.25, ease: OUT }, T + 0.15)
      .from($('.sp-msg.me'), { opacity: 0, x: 20, duration: 0.25, ease: OUT }, T + 0.45);
    type(tl, $('.sp-chat .sp-typed'), T + 0.55, 0.55);
  }

  /* ---------- 7 · December: the year's totals ---------- */
  {
    const T = 6 * SCENE;
    tl.from($$('.sp-stats div'), { opacity: 0, y: 16, duration: 0.25, stagger: 0.1, ease: OUT }, T + 0.1);
    $$('.sp-stats b[data-count]').forEach((b, k) => {
      const v = { n: 0 }, end = +b.dataset.count;
      tl.to(v, { n: end, duration: 0.6, ease: 'power2.out', onUpdate: () => { b.textContent = Math.round(v.n); } }, T + 0.3 + k * 0.1);
    });
    tl.from($('.sp-next'), { opacity: 0, x: -16, duration: 0.3, ease: OUT }, T + 0.9)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.sp-stage'),
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
