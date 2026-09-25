/* =====================================================================
   Launch a new product: from a napkin to a launch.

   One idea (a fictional plant-care app, Sprout) goes all the way:
     1 Overview     a sketch draws itself on a napkin (plays on load)
     2 Waitlist     the sketch comes to life as a real landing page; people sign up
     3 First version the idea list is cut down: three notes go to Later, three become v1
     4 Launch day   Launch is pressed; sign-ups, customers and feedback climb
     5 Learn fast   requests collect votes; the top one becomes version two
     6 Live         the napkin and the live app, side by side
   Pinned, scrubbed by scroll; smooth crossfades between chapters.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('launchJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.ln-scene'), fit = $('.ln-fit');
  const chaps = $$('.ln-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 760 × 520 and scaled to fit ---------- */
  const W = 760, H = 520;
  const size = () => {
    const col = $('.ln-side').clientWidth;
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
  const type = (tl, el, at, dur) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const count = (tl, el, at, dur = 0.5) => {
    const end = +el.dataset.count, v = { n: 0 };
    el.textContent = '0';
    tl.to(v, { n: end, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(v.n).toLocaleString('en-US'); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  const napkin = $('.ln-napkin'), page = $('.ln-page'), board = $('.ln-board'), dash = $('.ln-dash'), votes = $('.ln-votes');

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(napkin, { rotation: -4 });
  gsap.set([page, board, dash, votes], { autoAlpha: 0 });
  gsap.set($$('.ln-sketch path, .ln-sketch circle'), { drawSVG: '0%' });
  gsap.set($$('.ln-note'), { opacity: 0 });

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

  /* ---------- 1 · the napkin sketch (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(napkin, { autoAlpha: 0, y: 40, rotation: -10, duration: 0.5, ease: 'power3.out' }, 0)
    .to($$('.ln-sketch path, .ln-sketch circle'), { drawSVG: '100%', duration: 0.18, stagger: 0.06, ease: 'power1.inOut' }, 0.35)
    .to($$('.ln-note'), { opacity: 1, duration: 0.2, stagger: 0.15 }, 0.9);

  /* ---------- every later chapter: new words ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
  }
  const swapIn = (out, inn, T) => tl.to(out, { autoAlpha: 0, y: -20, duration: 0.35, ease: SMOOTH }, T - 0.4)
    .fromTo(inn, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: SMOOTH, immediateRender: false }, T - 0.1);

  /* ---------- 2 · the sketch comes to life as the waitlist page ---------- */
  {
    const T = SCENE;
    tl.to(napkin, { autoAlpha: 0, rotation: 0, scale: 1.02, duration: 0.5, ease: SMOOTH }, T - 0.35)
      .fromTo(page, { autoAlpha: 0, rotation: -4, scale: 0.97 }, { autoAlpha: 1, rotation: 0, scale: 1, duration: 0.5, ease: SMOOTH, immediateRender: false }, T - 0.25)
      .from($$('.ln-page > *'), { opacity: 0, y: 12, duration: 0.2, stagger: 0.06, ease: OUT }, T + 0.05);
    type(tl, $('.ln-typed'), T + 0.45, 0.25);
    tl.fromTo($('.ln-join b'), { scale: 1 }, { keyframes: { scale: [1, 0.92, 1] }, duration: 0.12, immediateRender: false }, T + 0.75)
      .from($$('.ln-faces i'), { opacity: 0, x: -10, duration: 0.15, stagger: 0.06, ease: OUT }, T + 0.8);
    count(tl, $('.ln-count'), T + 0.8, 0.55);
  }

  /* ---------- 3 · cut it down to a first version ---------- */
  {
    const T = 2 * SCENE;
    swapIn(page, board, T);
    const notes = $$('.ln-sticky', board);
    tl.from(notes, { opacity: 0, y: -30, duration: 0.25, stagger: 0.05, ease: OUT }, T + 0.05)
      .from($('.ln-later'), { opacity: 0, duration: 0.2 }, T + 0.45);
    $$('.ln-sticky.cut', board).forEach((n, k) => {
      const dx = 505 + k * 22 - n.offsetLeft, dy = 385 + k * 12 - n.offsetTop;
      tl.to(n, { x: dx, y: dy, scale: 0.5, opacity: 0.55, rotation: 6 + k * 4, duration: 0.4, ease: SMOOTH }, T + 0.55 + k * 0.08);
    });
    tl.to($$('.ln-sticky.keep', board), { y: '+=40', opacity: 0, duration: 0.3, stagger: 0.05, ease: SMOOTH }, T + 0.85)
      .from($('.ln-v1'), { opacity: 0, y: 30, duration: 0.3, ease: OUT }, T + 0.95)
      .from($$('.ln-v1 li'), { opacity: 0, x: -10, duration: 0.15, stagger: 0.08, ease: OUT }, T + 1.1);
  }

  /* ---------- 4 · launch day: press Launch, the numbers climb ---------- */
  {
    const T = 3 * SCENE, go = $('.ln-go'), p = { v: 0 };
    swapIn(board, dash, T);
    tl.fromTo(go, { scale: 1 }, { keyframes: { scale: [1, 0.92, 1] }, duration: 0.14, immediateRender: false }, T + 0.3)
      .to(p, { v: 1, duration: 0.01, onUpdate: () => { go.classList.toggle('live', p.v > 0.5); $('.ln-go-t').textContent = p.v > 0.5 ? '● Live' : 'Launch'; } }, T + 0.36);
    const sparks = $('.ln-sparks');
    for (let k = 0; k < 14; k++) {
      const d = document.createElement('i'), a = (k / 14) * Math.PI * 2;
      sparks.appendChild(d);
      gsap.set(d, { opacity: 0 });
      tl.fromTo(d, { x: 0, y: 0, opacity: 1 }, { x: Math.cos(a) * 160, y: Math.sin(a) * 70, opacity: 0, duration: 0.45, ease: OUT, immediateRender: false }, T + 0.36);
    }
    $$('.ln-stats b').forEach((b, k) => count(tl, b, T + 0.45 + k * 0.1, 0.6));
    gsap.set($('.ln-chart path'), { drawSVG: '0%' });
    tl.from($$('.ln-stats > div'), { opacity: 0, y: 16, duration: 0.2, stagger: 0.06, ease: OUT }, T + 0.4)
      .to($('.ln-chart path'), { drawSVG: '100%', duration: 0.7, ease: SMOOTH }, T + 0.5);
  }

  /* ---------- 5 · learn fast: votes decide version two ---------- */
  {
    const T = 4 * SCENE;
    swapIn(dash, votes, T);
    tl.from($$('.ln-req', votes), { opacity: 0, x: 30, duration: 0.25, stagger: 0.07, ease: OUT }, T + 0.05);
    $$('.ln-req em', votes).forEach((e, k) => count(tl, e, T + 0.4 + k * 0.05, 0.55));
    tl.from($('.ln-v2', votes), { opacity: 0, y: 20, duration: 0.3, ease: OUT }, T + 1.05);
  }

  /* ---------- 6 · live: then and now ---------- */
  {
    const T = 5 * SCENE;
    tl.to(votes, { autoAlpha: 0, y: -20, duration: 0.35, ease: SMOOTH }, T - 0.4)
      .to(napkin, { autoAlpha: 1, x: -190, y: -10, scale: 0.58, rotation: -6, duration: 0.6, ease: SMOOTH }, T - 0.2)
      .fromTo(page, { autoAlpha: 0, x: 190, y: -10, scale: 0.58, rotation: 0 }, { autoAlpha: 1, duration: 0.5, ease: SMOOTH, immediateRender: false }, T - 0.1)
      .to($('.ln-arrow'), { opacity: 1, duration: 0.25 }, T + 0.35)
      .to($$('.ln-tag'), { opacity: 1, duration: 0.25, stagger: 0.12 }, T + 0.45)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.ln-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
