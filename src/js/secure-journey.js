/* =====================================================================
   Secure your software: lock the vault.

   A vault door with five bolts. Each chapter adds a layer of protection,
   shown in a panel beside the vault, and one bolt locks:
     1 Overview    the vault, unlocked: 5 weak spots (plays on load)
     2 Sign-in     password, then a 6-digit code; verified          → bolt 1
     3 Attacks     bots hit the shield and are stopped               → bolt 2
     4 Checked     a scan sweeps the findings and each is fixed      → bolt 3
     5 Least access roles light up; staff can't open payroll         → bolt 4
     6 Accountable the audit log flags an odd export and blocks it   → bolt 5
     7 Secured     the dial turns, the vault is sealed
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('secureJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.sc-scene'), fit = $('.sc-fit');
  const chaps = $$('.sc-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 800 × 520 and scaled to fit ---------- */
  const W = 800, H = 520;
  const size = () => {
    const col = $('.sc-side').clientWidth;
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
  const flag = (tl, el, name, at, on = true) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, on ? p.v > 0.5 : p.v < 0.5) }, at);
  };
  const swap = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };
  const type = (tl, el, at, dur) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  const bolts = $$('.sc-bolt'), dial = $('.sc-dial'), weak = $('.sc-weak'), weakT = $('.sc-weak-t');
  const CX = 220, CY = 240;                                              // the vault's centre in the scene

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(bolts, { '--d': '118px' });
  gsap.set($$('.sc-code i'), { opacity: 0 });

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

  /* ---------- 1 · the vault, unlocked (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from($('.sc-door'), { autoAlpha: 0, rotation: -40, scale: 0.9, duration: 0.7, ease: 'power3.out' }, 0)
    .from(bolts, { opacity: 0, duration: 0.2, stagger: 0.06 }, 0.5)
    .from($('.sc-status'), { opacity: 0, y: 10, duration: 0.3, ease: OUT }, 0.8);

  /* ---------- every later chapter: new words, its panel, and at the end one bolt locks ---------- */
  const panels = [null, $('.sc-signin'), $('.sc-attacks'), $('.sc-scan'), $('.sc-roles'), $('.sc-log'), null];
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    if (panels[i]) {
      tl.fromTo(panels[i], { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.3, ease: OUT, immediateRender: false }, T - 0.1)
        .to(panels[i], { opacity: 0, x: -10, duration: 0.25, ease: SMOOTH }, (i + 1) * SCENE - 0.45);
      // the bolt for this layer slides out and locks; the dial turns one notch
      const b = bolts[i - 1], at = T + 1.1;
      tl.to(b, { '--d': '152px', duration: 0.25, ease: OUT }, at)
        .to(dial, { rotation: `+=72`, duration: 0.3, ease: SMOOTH }, at);
      flag(tl, b, 'on', at + 0.1);
      swap(tl, weak, String(6 - i), String(5 - i), at + 0.12);
    }
  }

  /* ---------- 2 · two-step sign-in ---------- */
  {
    const T = SCENE;
    type(tl, $('.sc-typed'), T + 0.2, 0.2);
    tl.to($$('.sc-code i'), { opacity: 1, duration: 0.06, stagger: 0.06 }, T + 0.45)
      .from($('.sc-ok'), { opacity: 0, y: 8, duration: 0.18, ease: OUT }, T + 0.85);
  }

  /* ---------- 3 · attacks hit the shield ---------- */
  {
    const T = 2 * SCENE, bots = $('.sc-bots'), n = $('.sc-n'), v = { n: 0 };
    tl.to($('.sc-shield'), { opacity: 1, duration: 0.25 }, T + 0.05);
    for (let k = 0; k < 9; k++) {
      const b = document.createElement('i');
      b.className = 'sc-bot';
      b.textContent = '🤖';
      bots.appendChild(b);
      // bots come in from above and below the vault
      const ang = (k % 2 ? 1 : -1) * (35 + ((k * 23) % 80)) * (Math.PI / 180), sx = CX + Math.cos(ang) * 330, sy = CY + Math.sin(ang) * 300;
      const dx = sx - CX, dy = sy - CY, d = Math.hypot(dx, dy);
      const ex = CX + (dx / d) * 200 - 13, ey = CY + (dy / d) * 200 - 13, at = T + 0.2 + k * 0.08;
      gsap.set(b, { x: sx, y: sy, opacity: 0 });
      tl.to(b, { opacity: 1, duration: 0.04 }, at)
        .to(b, { x: ex, y: ey, duration: 0.25, ease: 'sine.in' }, at)
        .to(b, { scale: 1.8, opacity: 0, duration: 0.12, ease: OUT }, at + 0.25);
    }
    tl.to(v, { n: 1204, duration: 0.8, ease: 'power1.out', onUpdate: () => { n.textContent = Math.round(v.n).toLocaleString('en-US'); } }, T + 0.3)
      .to($('.sc-shield'), { opacity: 0.35, duration: 0.3 }, 3 * SCENE - 0.4);
  }

  /* ---------- 4 · the scan: each finding fixed as the beam passes ---------- */
  {
    const T = 3 * SCENE, rows = $$('.sc-scan p'), beam = $('.sc-beam');
    const found = ['Outdated', 'Weak', 'Unencrypted', 'Exposed'];
    rows.forEach((r, k) => {
      const em = $('em', r), fixedText = em.textContent;
      em.textContent = found[k];
      const at = T + 0.4 + k * 0.14;
      swap(tl, em, found[k], `✓ ${fixedText}`, at);
      flag(tl, em, 'fixed', at);
    });
    tl.set(beam, { y: 30 }, T + 0.25)
      .to(beam, { opacity: 1, duration: 0.05 }, T + 0.25)
      .to(beam, { y: 230, duration: 0.65, ease: SMOOTH }, T + 0.25)
      .to(beam, { opacity: 0, duration: 0.08 }, T + 0.9);
  }

  /* ---------- 5 · access by role ---------- */
  {
    const T = 4 * SCENE, cells = $$('.sc-grid i');
    cells.forEach((c, k) => flag(tl, c, 'on', T + 0.25 + k * 0.05));
    flag(tl, $('.sc-grid i.deny'), 'hit', T + 0.85);
    tl.to($('.sc-denied'), { opacity: 1, duration: 0.2 }, T + 0.88);
  }

  /* ---------- 6 · the audit log flags something odd ---------- */
  {
    const T = 5 * SCENE, lines = $$('.sc-lines p');
    tl.from(lines, { opacity: 0, x: -10, duration: 0.15, stagger: 0.12, ease: OUT }, T + 0.15);
    flag(tl, $('.sc-lines p.flag'), 'on', T + 0.7);
    tl.to($('.sc-alert'), { opacity: 1, duration: 0.2 }, T + 0.9);
  }

  /* ---------- 7 · secured ---------- */
  {
    const T = 6 * SCENE;
    tl.to(dial, { rotation: '+=360', duration: 0.8, ease: SMOOTH }, T + 0.1)
      .to($('.sc-shield'), { opacity: 1, borderColor: 'rgba(74,222,128,0.7)', boxShadow: '0 0 50px rgba(74,222,128,0.4), inset 0 0 40px rgba(74,222,128,0.2)', duration: 0.4 }, T + 0.5);
    flag(tl, $('.sc-dial b'), 'safe', T + 0.6);
    tl.fromTo($('.sc-report'), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.3, ease: OUT, immediateRender: false }, T + 0.3)
      .from($$('.sc-report li'), { opacity: 0, x: -10, duration: 0.15, stagger: 0.1, ease: OUT }, T + 0.45);
    flag(tl, $('.sc-status'), 'safe', T + 0.6);
    swap(tl, weakT, 'weak spots', 'weak spots · secured', T + 0.6);
    tl.to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.sc-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
