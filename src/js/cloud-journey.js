/* =====================================================================
   Cloud page: a live map of your infrastructure.

   One architecture diagram, with traffic flowing along its wires the
   whole time. Each chapter, a selection box glides to one part of the
   system, the rest dims, and that part does its job:
     1 Overview     the map draws itself and traffic starts (plays on load)
     2 Deployments  a commit runs the pipeline, then rolls out server by server
     3 Monitoring   a server slows down, an alert fires, it's fixed
     4 Backups      nightly snapshots stack up in the vault; the restore test passes
     5 Security     attacks hit the firewall and are stopped
     6 Cost         the oversized server is right-sized; the bill drops
     7 Launch       everything lights up: all systems operational
   Pinned and scrubbed by scroll. No zooming: only the selection moves.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('cloudJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const map = $('.cl-map'), fit = $('.cl-fit');
  const chaps = $$('.cl-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- the map is drawn at 760 × 480 and scaled to fit ---------- */
  const W = 760, H = 480;
  const size = () => {
    const col = $('.cl-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.34 : 0.66)) / H, 1.2);
    map.style.transform = `scale(${k})`;
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
  const text = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };

  /* ---------- the parts of the system ---------- */
  const groups = {};
  $$('[data-g]', map).forEach((el) => { (groups[el.dataset.g] ||= []).push(el); });
  const all = $$('[data-g]', map);
  const sel = $('.cl-sel'), selT = $('.cl-sel-t');
  // where the selection box sits, what it's called, and which parts stay lit, per chapter
  const WHOLE = { x: 8, y: 8, w: 744, h: 464 };
  const FOCUS = [
    { box: WHOLE, name: 'System', lit: null },
    { box: { x: 10, y: 22, w: 600, h: 86 }, name: 'Deploy pipeline', lit: ['dev', 'pipe', 'srv'] },
    { box: { x: 430, y: 140, w: 326, h: 276 }, name: 'Monitoring', lit: ['srv', 'mon'] },
    { box: { x: 260, y: 390, w: 496, h: 88 }, name: 'Database + backups', lit: ['db'] },
    { box: { x: 10, y: 252, w: 390, h: 166 }, name: 'Firewall', lit: ['users', 'fw', 'lb'] },
    { box: { x: 430, y: 160, w: 326, h: 268 }, name: 'Right-sizing', lit: ['srv', 'cost'] },
    { box: WHOLE, name: 'Production', lit: null },
  ];
  const boxVars = (b) => ({ x: b.x, y: b.y, width: b.w, height: b.h });

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(sel, { ...boxVars(WHOLE), autoAlpha: 0 });
  const wires = $$('.cl-wires path', map);
  gsap.set(wires, { drawSVG: '0%' });
  gsap.set($('.cl-traffic'), { autoAlpha: 0 });

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

  /* ---------- 1 · the map draws itself (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(map, { autoAlpha: 0, y: 30, duration: 0.5, ease: 'power3.out' }, 0)
    .from(all, { autoAlpha: 0, y: 10, duration: 0.25, stagger: 0.04, ease: 'power2.out' }, 0.3)
    .to(wires, { drawSVG: '100%', duration: 0.35, stagger: 0.04, ease: 'power1.inOut' }, 0.6)
    .to($('.cl-traffic'), { autoAlpha: 1, duration: 0.3 }, 1.1)
    .to(sel, { autoAlpha: 1, duration: 0.3 }, 1.2);

  /* ---------- every later chapter: the selection glides, the rest dims ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE, f = FOCUS[i];
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1)
      .to(sel, { ...boxVars(f.box), duration: 0.6, ease: 'sine.inOut' }, T - 0.35);
    text(tl, selT, FOCUS[i - 1].name, f.name, T - 0.05);
    const lit = f.lit ? f.lit.flatMap((g) => groups[g]) : all;
    const dim = all.filter((el) => !lit.includes(el));
    tl.to(lit, { opacity: 1, duration: 0.35, ease: 'sine.inOut' }, T - 0.3);
    if (dim.length) tl.to(dim, { opacity: 0.25, duration: 0.35, ease: 'sine.inOut' }, T - 0.3);
  }

  /* ---------- 2 · deployments: the commit runs the pipeline, then rolls out ---------- */
  {
    const T = SCENE;
    const dot = $('.cl-commit'), stages = $$('.cl-stage-n', map), srv = $$('.cl-srv', map);
    tl.set(dot, { x: 80, y: 65 }, T + 0.2).to(dot, { opacity: 1, duration: 0.08 }, T + 0.2);
    [218, 328, 438, 548].forEach((x, k) => {
      const at = T + 0.3 + k * 0.15;
      tl.to(dot, { x, duration: 0.12, ease: 'sine.inOut' }, at);
      flag(tl, stages[k], 'done', at + 0.12);
      tl.to($('i', stages[k]), { scale: 1, duration: 0.1, ease: 'power2.out' }, at + 0.12);
    });
    tl.to(dot, { x: 505, y: 170, duration: 0.15, ease: 'sine.inOut' }, T + 0.92)
      .to(dot, { opacity: 0, duration: 0.06 }, T + 1.06)
      // the selection follows the release down to the servers
      .to(sel, { ...boxVars({ x: 430, y: 118, w: 150, h: 296 }), duration: 0.35, ease: 'sine.inOut' }, T + 0.85);
    text(tl, selT, 'Deploy pipeline', 'Rolling out', T + 0.95);
    srv.forEach((s, k) => {
      const at = T + 1.02 + k * 0.1;
      flag(tl, s, 'upd', at);
      text(tl, $('.cl-ver', s), 'v1.4', 'v1.5', at + 0.03);
      flag(tl, s, 'upd', at + 0.12, false);
    });
    tl.to($('.cl-zero'), { opacity: 1, duration: 0.15 }, T + 1.3)
      .to($('.cl-zero'), { opacity: 0, duration: 0.1 }, 2 * SCENE - 0.4);
  }

  /* ---------- 3 · monitoring: a slow server, an alert, fixed ---------- */
  {
    const T = 2 * SCENE;
    const web2 = $$('.cl-srv', map)[1], bar = $$('.cl-bars i', map)[8], alert = $('.cl-alert');
    flag(tl, web2, 'bad', T + 0.35);
    tl.to(bar, { height: '96%', backgroundColor: '#EF4444', duration: 0.15, ease: 'power2.out' }, T + 0.35)
      .fromTo(alert, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out', immediateRender: false }, T + 0.45);
    flag(tl, web2, 'bad', T + 0.95, false);
    flag(tl, alert, 'ok', T + 0.95);
    text(tl, $('.cl-alert-t'), 'web-2 is slow', 'web-2 is healthy', T + 0.95);
    text(tl, $('.cl-alert-s'), 'Restarting automatically…', 'Fixed in 40 seconds, before anyone noticed', T + 0.95);
    tl.to(bar, { height: '30%', backgroundColor: '#38BDF8', duration: 0.2, ease: 'sine.inOut' }, T + 0.95)
      .to(alert, { opacity: 0, duration: 0.12 }, 3 * SCENE - 0.4);
  }

  /* ---------- 4 · backups: snapshots stack up in the vault ---------- */
  {
    const T = 3 * SCENE;
    const dot = $('.cl-snap-dot'), snaps = $$('.cl-snaps i', map);
    gsap.set(snaps, { opacity: 0, y: 8 });
    tl.set(dot, { x: 390, y: 430 }, T + 0.3).to(dot, { opacity: 1, duration: 0.05 }, T + 0.3);
    snaps.forEach((s, k) => {
      const at = T + 0.32 + k * 0.1;
      tl.fromTo(dot, { x: 390, y: 430 }, { x: 470 + k * 24, y: 446, duration: 0.09, ease: 'sine.inOut', immediateRender: false }, at)
        .to(s, { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, at + 0.08);
    });
    tl.to(dot, { opacity: 0, duration: 0.05 }, T + 1.05)
      .from($('.cl-restore'), { opacity: 0, x: 10, duration: 0.15, ease: 'power2.out' }, T + 1.1);
  }

  /* ---------- 5 · security: attacks stopped at the firewall ---------- */
  {
    const T = 4 * SCENE;
    const bad = $$('.cl-bad'), count = $('.cl-blocked span'), shield = $('.cl-shield');
    tl.to($('.cl-blocked'), { opacity: 1, duration: 0.12 }, T + 0.3);
    bad.forEach((b, k) => {
      const at = T + 0.35 + k * 0.22;
      tl.fromTo(b, { x: 60, y: 322 + k * 18, opacity: 0, scale: 1 }, { x: 186, opacity: 1, duration: 0.16, ease: 'sine.in', immediateRender: false }, at)
        .to(b, { scale: 2.6, opacity: 0, duration: 0.1, ease: 'power2.out' }, at + 0.16)
        .fromTo(shield, { boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.45), 0 0 0 rgba(239,68,68,0)' }, { keyframes: { boxShadow: ['inset 0 0 0 2px rgba(239,68,68,0.9), 0 0 30px rgba(239,68,68,0.55)', 'inset 0 0 0 1px rgba(56,189,248,0.45), 0 0 0 rgba(239,68,68,0)'] }, duration: 0.18, immediateRender: false }, at + 0.16);
      text(tl, count, String(k), String(k + 1), at + 0.17);
    });
  }

  /* ---------- 6 · cost: right-size the big server, the bill drops ---------- */
  {
    const T = 5 * SCENE;
    const big = $('.cl-srv.big'), bill = $('.cl-bill'), v = { n: 1150 };
    tl.to(big, { scale: 0.86, transformOrigin: '0% 50%', duration: 0.3, ease: 'sine.inOut' }, T + 0.35);
    text(tl, $('.cl-ver', big), 'v1.5', 'right-sized', T + 0.5);
    tl.to(v, { n: 640, duration: 0.6, ease: 'power2.out', onUpdate: () => { bill.textContent = '$' + Math.round(v.n).toLocaleString('en-US'); } }, T + 0.45)
      .to($('.cl-needle'), { rotate: 45, duration: 0.6, ease: 'power2.out' }, T + 0.45);
  }

  /* ---------- 7 · launch: all systems operational ---------- */
  {
    const T = 6 * SCENE;
    tl.fromTo($('.cl-status'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', immediateRender: false }, T + 0.35)
      .to($$('.cl-srv', map), { boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.6), 0 0 18px rgba(34,197,94,0.25)', duration: 0.3, stagger: 0.06 }, T + 0.45)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.cl-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
