/* =====================================================================
   Personalized AI page: meet the assistant.

   A glowing orb in the middle is the assistant. Each chapter, what's
   around it drifts away and the next thing drifts in:
     1 Overview      the orb gathers itself out of particles and says hello (plays on load)
     2 Knows you     documents float in and are absorbed; its knowledge ring fills
     3 Right answer  answers from your data with its source; web search is off; if it isn't
                     in your data, it says so instead of guessing
     4 Takes action  one request becomes a drafted reply, a booked call, an updated CRM
     5 Connected     the tools light up around it, with signals running out to each
     6 Everywhere    the same answer appears on the website, Slack, text and Teams
     7 Limits        a boundary rings it: approved documents inside, payroll kept out
     8 Launch        online, ready for a question
   Pinned and scrubbed by scroll; smooth drifts only, no zooming or bouncing.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('aiJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.pa-scene'), fit = $('.pa-fit');
  const chaps = $$('.pa-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 720 × 520 and scaled to fit ---------- */
  const W = 720, H = 520, CX = 360, CY = 260;
  const size = () => {
    const col = $('.pa-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.68)) / H, 1.2);
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
  const centre = (el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
  const toOrb = (el) => { const c = centre(el); return { x: CX - c.x, y: CY - c.y }; };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  /* ---------- starting state ---------- */
  const groups = $$('.pa-g');
  const group = (i) => $(`.pa-g[data-c="${i}"]`);
  const know = $('.pa-know'), spokes = $$('.pa-spokes path'), reach = $$('.pa-reach path'), dome = $('.pa-dome');
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(groups, { autoAlpha: 0 });
  gsap.set([know, ...spokes, ...reach, dome], { drawSVG: '0%' });
  // the particles the orb gathers from
  const motes = $('.pa-motes');
  const dots = Array.from({ length: 28 }, (_, k) => {
    const d = document.createElement('i');
    const a = (k / 28) * Math.PI * 2, r = 170 + (k % 5) * 30;
    gsap.set(d, { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * 0.8, opacity: 0 });
    motes.appendChild(d);
    return d;
  });

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

  /* ---------- 1 · the orb gathers itself and says hello (plays on load) ---------- */
  gsap.set($('.pa-orb'), { scale: 0.2, opacity: 0 });
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .to(dots, { opacity: 1, duration: 0.2, stagger: 0.01 }, 0)
    .to(dots, { x: CX, y: CY, duration: 0.7, stagger: 0.012, ease: 'power2.in' }, 0.25)
    .to(dots, { opacity: 0, duration: 0.1 }, 0.95)
    .to($('.pa-orb'), { scale: 1, opacity: 1, duration: 0.5, ease: OUT }, 0.85)
    .from($('.pa-hello'), { autoAlpha: 0, y: 12, duration: 0.3, ease: OUT }, 1.25);

  /* ---------- every later chapter: the old things drift away, the new ones drift in ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    const prev = i === 1 ? $('.pa-hello') : group(i - 1);
    tl.fromTo(prev, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.05, duration: 0.35, ease: SMOOTH, immediateRender: false }, T - 0.35)
      .set(group(i), { autoAlpha: 1 }, T);
  }

  /* ---------- 2 · knows your business: documents are absorbed ---------- */
  {
    const T = SCENE, g = group(1);
    const docs = $$('.pa-doc', g);
    tl.from(docs, { opacity: 0, x: (k) => (k % 2 ? 40 : -40), duration: 0.3, stagger: 0.06, ease: OUT }, T + 0.05);
    docs.forEach((d, k) => {
      const at = T + 0.45 + k * 0.12, v = toOrb(d);
      tl.to(d, { x: v.x, y: v.y, scale: 0.15, opacity: 0, duration: 0.3, ease: 'power2.in' }, at);
    });
    tl.to(know, { drawSVG: '100%', duration: 0.6, ease: SMOOTH }, T + 0.5)
      .from($('.pa-knows', g), { opacity: 0, y: 10, duration: 0.2, ease: OUT }, T + 0.95);
    const n = $('.pa-n', g), v = { n: 0 };
    tl.to(v, { n: 1563, duration: 0.4, ease: OUT, onUpdate: () => { n.textContent = Math.round(v.n).toLocaleString('en-US'); } }, T + 0.95)
      .to(know, { opacity: 0, duration: 0.3 }, 2 * SCENE - 0.35);
  }

  /* ---------- 3 · right answer or no answer: from your data, never a guess ---------- */
  {
    const T = 2 * SCENE, g = group(2);
    const [q1, q2] = $$('.pa-bub.them', g), [a1, a2] = $$('.pa-bub.me', g);
    tl.from(q1, { opacity: 0, x: -30, duration: 0.25, ease: OUT }, T + 0.05)
      .from(a1, { opacity: 0, x: 30, duration: 0.2, ease: OUT }, T + 0.25);
    type(tl, $('.pa-typed', a1), T + 0.3, 0.3);
    tl.from($('.pa-cite', g), { opacity: 0, y: 8, duration: 0.18, ease: OUT }, T + 0.62)
      .from($('.pa-web', g), { opacity: 0, x: -14, duration: 0.2, ease: OUT }, T + 0.62)
      .from(q2, { opacity: 0, x: -30, duration: 0.2, ease: OUT }, T + 0.75)
      .from(a2, { opacity: 0, x: 30, duration: 0.2, ease: OUT }, T + 0.92);
    type(tl, $('.pa-typed', a2), T + 0.97, 0.35);
  }

  /* ---------- 4 · takes action: one request, three things done ---------- */
  {
    const T = 3 * SCENE, g = group(3);
    tl.from($('.pa-bub.cmd', g), { opacity: 0, y: -20, duration: 0.3, ease: OUT }, T + 0.1);
    $$('.pa-act', g).forEach((a, k) => {
      const at = T + 0.5 + k * 0.18, v = toOrb(a);
      tl.from(a, { x: v.x, y: v.y, scale: 0.3, opacity: 0, duration: 0.35, ease: OUT }, at)
        .from($('i', a), { scale: 0, opacity: 0, duration: 0.12, ease: OUT }, at + 0.3);
    });
  }

  /* ---------- 5 · connected: tools light up, signals run out to each ---------- */
  {
    const T = 4 * SCENE, g = group(4);
    tl.to(spokes, { drawSVG: '100%', duration: 0.35, stagger: 0.06, ease: SMOOTH }, T + 0.1);
    $$('.pa-tool', g).forEach((t, k) => {
      const at = T + 0.3 + k * 0.08, v = toOrb(t);
      tl.from(t, { x: v.x * 0.4, y: v.y * 0.4, opacity: 0, duration: 0.3, ease: OUT }, at);
    });
    // signals running out along the spokes
    const ends = [[360, 70], [525, 165], [525, 355], [360, 450], [195, 355], [195, 165]];
    ends.forEach(([x, y], k) => {
      const p = document.createElement('i');
      p.className = 'pa-pulse';
      g.appendChild(p);
      gsap.set(p, { x: CX, y: CY, opacity: 0 });
      const at = T + 0.8 + k * 0.07;
      tl.to(p, { opacity: 1, duration: 0.04 }, at)
        .to(p, { x, y, duration: 0.3, ease: SMOOTH }, at)
        .to(p, { opacity: 0, duration: 0.06 }, at + 0.28);
    });
    tl.to(spokes, { opacity: 0, duration: 0.3 }, 5 * SCENE - 0.35);
  }

  /* ---------- 6 · everywhere: the same answer on every surface ---------- */
  {
    const T = 5 * SCENE, g = group(5);
    tl.to(reach, { drawSVG: '100%', duration: 0.35, stagger: 0.05, ease: SMOOTH }, T + 0.1);
    $$('.pa-surf', g).forEach((s, k) => {
      const at = T + 0.25 + k * 0.12;
      tl.from(s, { opacity: 0, y: k < 2 ? -20 : 20, duration: 0.3, ease: OUT }, at)
        .from($('.pa-mini', s), { opacity: 0, x: -10, duration: 0.2, ease: OUT }, at + 0.35);
    });
    tl.to(reach, { opacity: 0, duration: 0.3 }, 6 * SCENE - 0.35);
  }

  /* ---------- 7 · clear limits: a boundary; approved inside, payroll kept out ---------- */
  {
    const T = 6 * SCENE, g = group(6);
    tl.to(dome, { drawSVG: '100%', duration: 0.5, ease: SMOOTH }, T + 0.1)
      .from($$('.pa-ok', g), { opacity: 0, scale: 0.8, duration: 0.2, stagger: 0.08, ease: OUT }, T + 0.4)
      .from($('.pa-no', g), { opacity: 0, x: 20, duration: 0.25, ease: OUT }, T + 0.55);
    const probe = $('.pa-probe', g);
    gsap.set(probe, { x: 610, y: 60, opacity: 0 });
    tl.to(probe, { opacity: 1, duration: 0.05 }, T + 0.75)
      .to(probe, { x: 492, y: 150, duration: 0.3, ease: 'sine.out' }, T + 0.75)
      .to(probe, { opacity: 0, scale: 2, duration: 0.12, ease: OUT }, T + 1.05)
      .fromTo(dome, { stroke: '#C4A7FF' }, { keyframes: { stroke: ['#F87171', '#C4A7FF'] }, duration: 0.3, immediateRender: false }, T + 1.05)
      .from($('.pa-rules', g), { opacity: 0, y: 12, duration: 0.25, ease: OUT }, T + 1.1)
      .to(dome, { opacity: 0, duration: 0.3 }, 7 * SCENE - 0.35);
  }

  /* ---------- 8 · launch: online, ready for a question ---------- */
  {
    const T = 7 * SCENE, g = group(7);
    tl.from($('.pa-online', g), { opacity: 0, y: -10, duration: 0.25, ease: OUT }, T + 0.15)
      .from($('.pa-ask', g), { opacity: 0, y: 20, duration: 0.3, ease: OUT }, T + 0.3);
    type(tl, $('.pa-typed', g), T + 0.55, 0.45);
    tl.to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.pa-stage'),
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
