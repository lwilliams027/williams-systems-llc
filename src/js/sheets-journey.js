/* =====================================================================
   Replace spreadsheets: the sheet becomes the app.

     1 Overview      the jobs spreadsheet (plays on load)
     2 Today         three people's cursors in the same cells, a #REF!, "someone else is editing"
     3 Tomorrow      each row lifts off the grid and lands as a card on the schedule
     4 From the field the crew marks a job done on a phone; the card updates at once
     5 Reports       the cards fold into the week's numbers and revenue bars
     6 History       a price changes, and the history shows who changed it
     7 Switch over   the old file goes into the archive; the move is checked off
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('sheetsJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.rs-scene'), fit = $('.rs-fit');
  const chaps = $$('.rs-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 780 × 520 and scaled to fit ---------- */
  const W = 780, H = 520;
  const size = () => {
    const col = $('.rs-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.66)) / H, 1.2);
    scene.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  // the schedule: where each job's card sits (day column, and its place in that column)
  const cardAt = (day, k) => ({ x: 16 + day * 144, y: 92 + k * 84 });
  $$('.rs-card').forEach((c) => { const p = cardAt(+c.dataset.day, +c.dataset.k); c.style.left = `${p.x}px`; c.style.top = `${p.y}px`; });
  $$('.rs-bars i').forEach((b) => b.style.setProperty('--h', b.dataset.h));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    return;
  }

  /* ---------- helpers (reversible, for a scrubbed timeline) ---------- */
  const flag = (tl, el, name, at, on = true) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, on ? p.v > 0.5 : p.v < 0.5) }, at);
  };
  const swap = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };
  const count = (tl, el, at, dur = 0.6) => {
    const end = +el.dataset.count, pre = el.dataset.prefix || '', v = { n: 0 };
    tl.to(v, { n: end, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = pre + Math.round(v.n).toLocaleString('en-US'); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  const win = $('.rs-win'), sheet = $('.rs-sheet'), app = $('.rs-app');
  const rows = $$('.rs-row'), cards = $$('.rs-card');
  const COLS = [0, 36, 176, 346, 446, 526, 616];                       // where each spreadsheet column starts
  const cell = (row, col) => ({ x: COLS[col] + 6, y: rows[row].offsetTop + 6 });

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  sheet.style.zIndex = 2; app.style.zIndex = 1;                        // rows fly over the app as it appears
  gsap.set(cards, { opacity: 0 });
  gsap.set(win, { filter: 'brightness(1)' });
  const link = document.createElement('i');
  link.className = 'rs-link';
  scene.appendChild(link);

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

  /* ---------- 1 · the spreadsheet (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(win, { autoAlpha: 0, y: 30, duration: 0.5, ease: 'power3.out' }, 0)
    .from(rows, { opacity: 0, x: -12, duration: 0.2, stagger: 0.06, ease: OUT }, 0.4)
    .from($$('.rs-tabs span'), { opacity: 0, duration: 0.15, stagger: 0.06 }, 0.8);

  /* ---------- every later chapter: new words ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
  }

  /* ---------- 2 · today: everyone in the same cells ---------- */
  {
    const T = SCENE, [c1, c2, c3] = $$('.rs-cur');
    const a = cell(1, 5), b = cell(4, 2), c = cell(3, 1);
    gsap.set(c1, { x: a.x, y: a.y }); gsap.set(c2, { x: b.x, y: b.y }); gsap.set(c3, { x: c.x, y: c.y });
    tl.to([c1, c2, c3], { opacity: 1, duration: 0.12, stagger: 0.08 }, T + 0.1)
      .to(c2, { x: a.x + 44, y: a.y, duration: 0.3, ease: SMOOTH }, T + 0.35)       // two people in the same cell
      .to(c3, { x: cell(4, 6).x, y: cell(4, 6).y, duration: 0.3, ease: SMOOTH }, T + 0.45)
      .to($('.rs-warn'), { opacity: 1, duration: 0.15 }, T + 0.5);
    const ref = $('.rs-ref');
    swap(tl, ref, 'Booked', '#REF!', T + 0.75);
    flag(tl, ref, 'bad', T + 0.75);
    swap(tl, $('.rs-formula'), '=SUM(E2:E7)', "=SUM(E2:E7)+'OLD'!#REF!", T + 0.75);
  }

  /* ---------- 3 · tomorrow: the rows become the schedule ---------- */
  {
    const T = 2 * SCENE;
    tl.to([...$$('.rs-cur'), $('.rs-warn')], { opacity: 0, duration: 0.2 }, T - 0.45)
      .to([$('.rs-xl-bar'), $('.rs-fx'), $('.rs-letters'), $('.rs-tabs')], { opacity: 0, duration: 0.3 }, T - 0.25)
      .to(app, { opacity: 1, duration: 0.35 }, T - 0.2)
      .from([$('.rs-app-bar'), $('.rs-days')], { opacity: 0, y: -10, duration: 0.25, stagger: 0.08, ease: OUT }, T - 0.1);
    rows.forEach((r, k) => {
      const c = cards[k], p = cardAt(+c.dataset.day, +c.dataset.k), at = T - 0.1 + k * 0.08;
      tl.to(r, { x: p.x, y: p.y - r.offsetTop, scaleX: 136 / 740, scaleY: 76 / 42, opacity: 0, duration: 0.55, ease: SMOOTH }, at)
        .fromTo(c, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.3, ease: OUT, immediateRender: false }, at + 0.35);
    });
  }

  /* ---------- 4 · from the field: done on the phone, updated on the board ---------- */
  {
    const T = 3 * SCENE, phone = $('.rs-phone'), btn = $('.rs-ph-btn'), card = cards[3];
    tl.fromTo(phone, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4, ease: SMOOTH, immediateRender: false }, T - 0.2)
      .fromTo(btn, { scale: 1 }, { keyframes: { scale: [1, 0.93, 1] }, duration: 0.12, immediateRender: false }, T + 0.45);
    swap(tl, btn, 'Mark job done', '✓ Done', T + 0.5);
    flag(tl, btn, 'done', T + 0.5);
    // a signal from the phone to the card on the board
    const from = { x: phone.offsetLeft + btn.offsetLeft + btn.offsetWidth / 2, y: phone.offsetTop + btn.offsetTop + btn.offsetHeight / 2 };
    const to = { x: win.offsetLeft + card.offsetLeft + 68, y: win.offsetTop + card.offsetTop + 38 };
    tl.fromTo(link, { x: from.x, y: from.y, opacity: 0 }, { opacity: 1, duration: 0.05, immediateRender: false }, T + 0.52)
      .to(link, { x: to.x, y: to.y, duration: 0.25, ease: SMOOTH }, T + 0.52)
      .to(link, { opacity: 0, duration: 0.05 }, T + 0.77);
    const st = $('.rs-st', card);
    swap(tl, st, 'Booked', 'Done', T + 0.78);
    flag(tl, st, 'done', T + 0.78);
    flag(tl, card, 'pulse', T + 0.78);
    flag(tl, card, 'pulse', T + 1.3, false);
    tl.to(phone, { opacity: 0, x: 40, duration: 0.3, ease: SMOOTH }, 4 * SCENE - 0.45);
  }

  /* ---------- 5 · reports: the week adds itself up ---------- */
  {
    const T = 4 * SCENE;
    tl.to(cards, { opacity: 0, y: 20, duration: 0.3, stagger: 0.04, ease: SMOOTH }, T - 0.3)
      .to($('.rs-report'), { opacity: 1, duration: 0.3 }, T + 0.05)
      .to($$('.rs-bars i'), { scaleY: 1, duration: 0.45, stagger: 0.07, ease: OUT }, T + 0.3);
    $$('.rs-n').forEach((n, k) => count(tl, n, T + 0.15 + k * 0.1, 0.6));
  }

  /* ---------- 6 · history: who changed what ---------- */
  {
    const T = 5 * SCENE, hist = $('.rs-hist'), price = $('.rs-price', cards[1]);
    tl.to([$('.rs-report'), ...$$('.rs-bars i')], { opacity: 0, duration: 0.3 }, T - 0.45)
      .to(cards, { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: SMOOTH }, T - 0.25)
      .fromTo(hist, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.35, ease: OUT, immediateRender: false }, T + 0.1)
      .from($$('.rs-hist p:not(.new)'), { opacity: 0, y: 8, duration: 0.2, stagger: 0.08 }, T + 0.3)
      .fromTo(price, { backgroundColor: 'rgba(250,204,21,0)' }, { keyframes: { backgroundColor: ['rgba(250,204,21,0.9)', 'rgba(250,204,21,0.9)', 'rgba(250,204,21,0)'] }, duration: 0.6, immediateRender: false }, T + 0.6)
      .from($('.rs-hist p.new'), { opacity: 0, y: -8, duration: 0.2, ease: OUT }, T + 0.7);
    swap(tl, price, '$480', '$520', T + 0.65);
  }

  /* ---------- 7 · switch over: the old file is retired ---------- */
  {
    const T = 6 * SCENE, arch = $('.rs-archive'), file = $('.rs-xlsx'), folder = $('.rs-folder');
    tl.to($('.rs-hist'), { opacity: 0, duration: 0.25 }, T - 0.45)
      .to(win, { filter: 'brightness(0.55)', duration: 0.3 }, T - 0.2)
      .to(arch, { opacity: 1, duration: 0.3 }, T - 0.1)
      .to(file, { x: -(file.offsetLeft - folder.offsetLeft) + 20, scale: 0.5, opacity: 0, duration: 0.5, ease: SMOOTH }, T + 0.35)
      .fromTo($('.rs-checks'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: OUT, immediateRender: false }, T + 0.3)
      .from($$('.rs-checks li'), { opacity: 0, x: -10, duration: 0.15, stagger: 0.12 }, T + 0.45)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.rs-stage'),
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
