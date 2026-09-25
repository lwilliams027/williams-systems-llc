/* =====================================================================
   SaaS page: follow one customer through the business.

   A strip of stations sits in a row: landing page, pricing, sign-up,
   onboarding, analytics, admin, payments, live. The camera glides from one
   to the next, the customer rides a glowing track along the bottom, and the monthly
   revenue and customer count above keep climbing. Pinned, scrubbed by
   scroll; chapter 1 plays by itself on load.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('saasJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const view = $('.sa-view'), fit = $('.sa-fit');
  const chaps = $$('.sa-chap');
  const st = $$('.sa-st');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- the scene is drawn at 720 × 500 and scaled to fit ---------- */
  const W = 720, H = 500;
  const size = () => {
    const col = $('.sa-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.32 : 0.62)) / H, 1.15);
    view.style.transform = `scale(${k})`;
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
  const cls = (tl, el, name, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, p.v > 0.5) }, at);
  };
  const type = (tl, el, at, dur = 0.3) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const num = (n) => Math.round(n).toLocaleString('en-US');
  const count = (tl, el, to, at, dur = 0.5, f = num) => {
    const v = { n: 0 };
    tl.to(v, { n: to, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = f(v.n); } }, at);
  };
  // the revenue counter only ever moves between the values each chapter ends on
  const mrr = $('.sa-mrr'), cust = $('.sa-cust');
  const hud = { m: 0, c: 0 };
  const paint = () => { mrr.textContent = money(hud.m); cust.textContent = num(hud.c); };
  const grow = (tl, m, c, at, dur = 0.4) => tl.to(hud, { m, c, duration: dur, ease: 'power2.out', onUpdate: paint }, at);

  /* ---------- starting state ---------- */
  const cam = $('.sa-cam'), world = $('.sa-world'), who = $('.sa-who');
  const trail = $('.sa-trail');
  const STEP = 800;
  const camX = (i) => -i * STEP;                         // each station lands in the middle of the window
  const whoX = (i) => i * STEP + 360;
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(world, { x: camX(0) });
  gsap.set(trail, { drawSVG: '0%' });
  gsap.set(who, { x: whoX(0) - 260, y: 0, autoAlpha: 0 });
  paint();

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

  /* ---------- 1 · the landing page (plays on load) ---------- */
  {
    const s = st[0];
    gsap.set(cam, { scale: 0.55, y: 30 });
    intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
      .from($('.sa-land', s), { autoAlpha: 0, y: 60, rotateX: 30, duration: 0.5, ease: 'power3.out' }, 0)
      .to(cam, { scale: 1, y: 0, duration: 0.8, ease: 'power3.inOut' }, 0.3)
      .from($$('.sa-land > *', s), { autoAlpha: 0, y: 14, duration: 0.2, stagger: 0.06 }, 0.35)
      .from($$('.sa-shots i', s), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.25, stagger: 0.07, ease: 'back.out(2)' }, 0.8)
      .to(who, { autoAlpha: 1, duration: 0.1 }, 0.9)
      .to(who, { x: whoX(0), duration: 0.45, ease: 'power2.out' }, 0.9)
      .to($('.sa-btn', s), { keyframes: { scale: [1, 1.08, 1] }, duration: 0.3, repeat: 1 }, 1.3);
  }

  /* ---------- every later chapter: fly to the next station ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    // glide to the next station; the customer rides along and the track lights up behind them
    tl.to(world, { x: camX(i), duration: 0.8, ease: 'sine.inOut' }, T - 0.4)
      .to(who, { x: whoX(i), duration: 0.75, ease: 'power2.inOut' }, T - 0.36)
      .to(who, { keyframes: { y: [0, -26, 0, -12, 0] }, duration: 0.75 }, T - 0.36)
      .to(trail, { drawSVG: `${(i / 7) * 100}%`, duration: 0.75, ease: 'power2.inOut' }, T - 0.36);
  }

  /* ---------- 2 · pricing: the cards deal in, Pro is picked, the trial stamps ---------- */
  {
    const T = SCENE, s = st[1];
    const plans = $$('.sa-plan', s);
    tl.from(plans, { rotateY: -90, autoAlpha: 0, duration: 0.3, stagger: 0.1, ease: 'back.out(1.4)' }, T + 0.15)
      .to(plans[1], { scale: 1.1, y: -10, duration: 0.25, ease: 'back.out(2)' }, T + 0.6)
      .to([plans[0], plans[2]], { scale: 0.94, autoAlpha: 0.7, duration: 0.25 }, T + 0.6)
      .from($('.sa-pick', s), { autoAlpha: 0, scale: 0.6, duration: 0.18, ease: 'back.out(2.5)' }, T + 0.8)
      .from($('.sa-stamp', s), { autoAlpha: 0, scale: 2.4, rotate: -20, duration: 0.18, ease: 'power4.in' }, T + 1.0);
    grow(tl, 49, 1, T + 0.85);
  }

  /* ---------- 3 · sign-up: type it in, a new locked workspace appears ---------- */
  {
    const T = 2 * SCENE, s = st[2];
    tl.from($('.sa-signup', s), { x: -60, autoAlpha: 0, duration: 0.3, ease: 'power3.out' }, T + 0.15);
    const [a, b] = $$('.sa-typed', s);
    type(tl, a, T + 0.35, 0.25);
    type(tl, b, T + 0.62, 0.18);
    tl.to($('.sa-signup .sa-btn', s), { keyframes: { scale: [1, 0.93, 1] }, duration: 0.12 }, T + 0.85);
    const ten = $$('.sa-tenant', s);
    tl.from(ten.slice(1), { autoAlpha: 0, x: 40, duration: 0.2, stagger: 0.08 }, T + 0.3)
      .from(ten[0], { autoAlpha: 0, scale: 0.5, duration: 0.25, ease: 'back.out(2)' }, T + 0.95)
      .from($('.sa-tenants p', s), { autoAlpha: 0, y: 8, duration: 0.2 }, T + 1.15);
  }

  /* ---------- 4 · onboarding: the ring fills, the list ticks, confetti ---------- */
  {
    const T = 3 * SCENE, s = st[3];
    const ring = $('.sa-ring .fg', s), pct = $('.sa-pct', s);
    gsap.set(ring, { drawSVG: '0%' });
    tl.from($('.sa-onb', s), { autoAlpha: 0, scale: 0.85, duration: 0.3, ease: 'back.out(1.6)' }, T + 0.1);
    const items = $$('.sa-list li', s);
    items.forEach((li, k) => {
      const at = T + 0.4 + k * 0.17;
      cls(tl, li, 'done', at);
      tl.to(ring, { drawSVG: `${((k + 1) / items.length) * 100}%`, duration: 0.15, ease: 'power2.out' }, at);
    });
    count(tl, pct, 100, T + 0.4, 0.68, (n) => `${Math.round(n)}%`);
    tl.from($('.sa-done', s), { autoAlpha: 0, y: 10, duration: 0.2 }, T + 1.1);
    $$('.sa-confetti i', s).forEach((c, k) => {
      const ang = (k / 12) * Math.PI * 2;
      tl.fromTo(c, { x: 0, y: 0, rotate: 0, autoAlpha: 0 },
        { keyframes: { autoAlpha: [1, 1, 0] }, x: Math.cos(ang) * (140 + (k % 3) * 40), y: Math.sin(ang) * 110 - 60, rotate: 360 + k * 40, duration: 0.5, ease: 'power2.out', immediateRender: false }, T + 1.08);
    });
  }

  /* ---------- 5 · analytics: the funnel fills, the numbers count ---------- */
  {
    const T = 4 * SCENE, s = st[4];
    tl.from($('.sa-funnel', s), { autoAlpha: 0, y: 40, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    $$('.sa-fbar', s).forEach((bar, k) => {
      const at = T + 0.35 + k * 0.12;
      tl.from($('i', bar), { scaleX: 0, duration: 0.35, ease: 'power3.out' }, at);
      const b = $('b', bar);
      count(tl, b, +b.dataset.count, at, 0.35);
    });
    tl.from($('.sa-drop', s), { autoAlpha: 0, x: -20, duration: 0.2 }, T + 1.05);
    grow(tl, 20188, 412, T + 0.75, 0.5);
  }

  /* ---------- 6 · admin: find the customer, upgrade their plan ---------- */
  {
    const T = 5 * SCENE, s = st[5];
    tl.from($('.sa-admin', s), { autoAlpha: 0, rotateX: -25, y: 30, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    type(tl, $('.sa-typed', s), T + 0.35, 0.2);
    tl.from($('.sa-cust-row', s), { autoAlpha: 0, y: 12, duration: 0.2 }, T + 0.58)
      .from($$('.sa-act', s), { autoAlpha: 0, y: 8, duration: 0.15, stagger: 0.05 }, T + 0.72)
      .to($('.sa-act.up', s), { keyframes: { scale: [1, 0.9, 1] }, duration: 0.12 }, T + 0.98);
    const chip = $('.sa-planchip', s), p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { chip.textContent = p.v > 0.5 ? 'Team' : 'Pro'; } }, T + 1.05)
      .fromTo(chip, { scale: 1 }, { keyframes: { scale: [1, 1.3, 1] }, duration: 0.2, immediateRender: false }, T + 1.05)
      .from($('.sa-note', s), { autoAlpha: 0, y: 8, duration: 0.18 }, T + 1.12);
    grow(tl, 20238, 412, T + 1.05, 0.3);
  }

  /* ---------- 7 · payments: the card flips to Paid, the receipt prints, a retry succeeds ---------- */
  {
    const T = 6 * SCENE, s = st[6];
    const card = $('.sa-card', s);
    tl.from(card, { autoAlpha: 0, x: -80, rotateZ: -12, duration: 0.3, ease: 'back.out(1.4)' }, T + 0.1)
      .to(card, { rotateY: 180, duration: 0.35, ease: 'power2.inOut' }, T + 0.55)
      .fromTo($('.sa-receipt', s), { clipPath: 'polygon(0 0, 100% 0, 100% 0%, 0 0%)', y: -10 }, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', y: 0, duration: 0.4, ease: 'steps(8)' }, T + 0.75)
      .from($('.sa-retry', s), { autoAlpha: 0, y: 14, duration: 0.2 }, T + 0.9);
    const r = $('.sa-rstat', s), p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { r.textContent = p.v > 0.5 ? 'Retried · Paid ✓' : 'Retrying…'; r.classList.toggle('ok', p.v > 0.5); } }, T + 1.2);
    grow(tl, 21990, 438, T + 1.0, 0.35);
  }

  /* ---------- 8 · live: the growth line draws, customers pour in ---------- */
  {
    const T = 7 * SCENE, s = st[7];
    const line = $('.sa-growth path', s);
    gsap.set(line, { drawSVG: '0%' });
    const crowd = $('.sa-crowd', s);
    for (let k = 0; k < 42; k++) {
      const d = document.createElement('i');
      d.style.left = `${(k * 37) % 520}px`;
      d.style.top = `${(k * 53) % 240}px`;
      crowd.appendChild(d);
    }
    tl.from($('.sa-live', s), { autoAlpha: 0, scale: 0.9, duration: 0.3 }, T + 0.1)
      .to(line, { drawSVG: '100%', duration: 0.6, ease: 'power1.inOut' }, T + 0.35)
      .from($$('i', crowd), { autoAlpha: 0, scale: 0, duration: 0.12, stagger: { each: 0.012, from: 'random' }, ease: 'back.out(3)' }, T + 0.5)
      .to(who, { scale: 1.3, duration: 0.2, ease: 'back.out(2)' }, T + 0.5)
      .to($('.sa-stat.live'), { autoAlpha: 1, duration: 0.15 }, T + 1.1)
      .to({}, { duration: 0.6 }, T + 1.45);                 // hold on the finish
    grow(tl, 48200, 1024, T + 0.5, 0.7);
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.sa-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
