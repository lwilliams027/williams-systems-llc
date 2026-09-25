/* =====================================================================
   Web apps page: the journey is a web app you use.

   One app window (Northwind Ops) stays on screen, pinned and scrubbed by
   scroll. Each chapter is a click inside it: the cursor moves to the
   sidebar, the address bar changes, a loading bar runs and the next screen
   slides in, while the camera moves around the window.
     1 Overview     the app builds itself: skeletons, then real numbers (plays on load)
     2 One place    the cursor runs down the sidebar, then ⌘K finds anything
     3 Dashboards   numbers count up, the live chart draws
     4 Spreadsheets a spreadsheet is dragged in and imported clean
     5 Roles        sign-in with a two-step code, then permission switches
     6 Automation   an invoice runs through the workflow by itself
     7 Integrations the switches flip on, records sync
     8 Launch       the deploy runs, localhost becomes northwind.app, Live
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { chapterNav, pinLength } from './chapter-nav.js';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, DrawSVGPlugin);

const section = document.getElementById('webapp');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const app = $('.wa-app');
  const fit = $('.wa-fit');
  const chaps = $$('.wa-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- the app is drawn at 1040 × 650 and scaled to fit ---------- */
  const W = 1040, H = 650;
  const size = () => {
    const col = $('.wa-cam').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.7)) / H, 1);
    app.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    return;
  }

  /* ---------- helpers ---------- */
  // where an element sits inside the app, in app pixels (ignores transforms)
  const spot = (el, fx = 0.5, fy = 0.5) => {
    let x = el.offsetWidth * fx, y = el.offsetHeight * fy;
    for (let n = el; n && n !== app; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };
  const view = (name) => $(`.wa-view[data-view="${name}"]`);
  const navItem = (name) => $(`.wa-nav [data-nav="${name}"]`);
  // reversible switches for a scrubbed timeline: a class or a text that flips at a moment
  const cls = (tl, el, name, at, on = true) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => el.classList.toggle(name, on ? p.v > 0.5 : p.v < 0.5) }, at);
  };
  const swap = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };
  const type = (tl, el, at, dur = 0.3) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  const count = (tl, el, at, dur = 0.6) => {
    const end = +el.dataset.count, pre = el.dataset.prefix || '', v = { n: 0 };
    el.textContent = pre + '0';
    tl.to(v, { n: end, duration: dur, ease: 'power2.out', onUpdate: () => { el.textContent = pre + Math.round(v.n).toLocaleString('en-US'); } }, at);
  };

  /* ---------- starting state ---------- */
  const cursor = $('.wa-cursor');
  const ring = document.createElement('i');
  ring.className = 'wa-click';
  app.appendChild(ring);
  const ind = $('.wa-ind');
  const host = $('.wa-host'), path = $('.wa-path');
  host.textContent = 'localhost:5173';                       // it only becomes northwind.app at launch
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set($$('.wa-view'), { autoAlpha: 0 });
  gsap.set(view('home'), { autoAlpha: 1 });
  gsap.set([ring, $('.wa-file'), $('.wa-toast')], { autoAlpha: 0 });
  const home = navItem('dashboard');
  home.classList.add('on');
  gsap.set(ind, { y: home.offsetTop, height: home.offsetHeight });
  gsap.set(cursor, { x: 620, y: 420, autoAlpha: 0 });
  gsap.set(fit, { transformPerspective: 1800, transformOrigin: '50% 50%' });

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

  const click = (t, at, p) => {
    t.set(ring, { x: p.x, y: p.y }, at)
      .fromTo(ring, { autoAlpha: 1, scale: 0.3 }, { autoAlpha: 0, scale: 1.5, duration: 0.2, ease: 'power2.out', immediateRender: false }, at)
      .to(cursor, { keyframes: { scale: [1, 0.8, 1] }, duration: 0.1 }, at);
  };
  const moveTo = (t, p, at, dur = 0.3) => t.to(cursor, { x: p.x - 4, y: p.y - 3, duration: dur, ease: 'power2.inOut' }, at);
  // the camera's pose for each chapter
  const CAM = [
    { rotateY: -9, rotateX: 5, scale: 1 },
    { rotateY: 4, rotateX: 2, scale: 1.04 },
    { rotateY: 9, rotateX: 3, scale: 1 },
    { rotateY: -7, rotateX: -3, scale: 1.02 },
    { rotateY: 0, rotateX: 0, scale: 1.08 },
    { rotateY: 0, rotateX: 16, scale: 0.98 },
    { rotateY: 10, rotateX: 4, scale: 1 },
    { rotateY: 0, rotateX: 0, scale: 1.03 },
  ];
  // what each chapter's click opens
  const ROUTES = [
    null,
    { view: 'search', path: '/search?q=inv' },
    { view: 'reports', nav: 'reports', path: '/reports/sales' },
    { view: 'import', nav: 'orders', path: '/orders/import' },
    { view: 'team', nav: 'team', path: '/team' },
    { view: 'flow', nav: 'automations', path: '/automations/invoice-approval' },
    { view: 'ints', nav: 'integrations', path: '/settings/integrations' },
    { view: 'deploy', path: '/deploy' },
  ];
  let current = home, currentView = view('home'), currentPath = '/dashboard';

  /* ---------- 1 · the app builds itself (plays on load) ---------- */
  gsap.set(fit, { rotateY: -24, rotateX: 14, scale: 0.9, y: 60, autoAlpha: 0 });
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .to(fit, { ...CAM[0], y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out' }, 0)
    .from($$('.wa-nav span'), { autoAlpha: 0, x: -14, duration: 0.2, stagger: 0.04 }, 0.4)
    .from($('.wa-top', view('home')), { autoAlpha: 0, y: 12, duration: 0.25 }, 0.45)
    .to($$('.sk', view('home')), { autoAlpha: 0, duration: 0.25, stagger: 0.08 }, 0.9)
    .from($$('.wa-recent .wa-row', view('home')), { autoAlpha: 0, y: 10, duration: 0.2, stagger: 0.05 }, 1.05)
    .to(cursor, { autoAlpha: 1, duration: 0.15 }, 1.1);
  moveTo(intro, spot($('.wa-btn', view('home'))), 1.15, 0.4);

  /* ---------- every later chapter: a click in the app ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    const r = ROUTES[i];
    const v = view(r.view);
    // words
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    // camera
    tl.to(fit, { ...CAM[i], duration: 0.7, ease: 'power2.inOut' }, T - 0.35);
    // click the sidebar (or, for search, press ⌘K after a run down the sidebar)
    if (r.nav) {
      const item = navItem(r.nav);
      moveTo(tl, spot(item, 0.4), T - 0.35);
      click(tl, T - 0.05, spot(item, 0.4));
      tl.to(ind, { y: item.offsetTop, duration: 0.22, ease: 'power3.out' }, T - 0.05);
      cls(tl, current, 'on', T - 0.04, false);
      cls(tl, item, 'on', T - 0.04);
      current = item;
    }
    // page load: the loading bar, the address, the old screen out and the new one in
    tl.fromTo($('.wa-load'), { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 0.3, ease: 'power2.out', immediateRender: false }, T)
      .to($('.wa-load'), { autoAlpha: 0, duration: 0.1 }, T + 0.3);
    swap(tl, path, currentPath, r.path, T + 0.02);
    currentPath = r.path;
    tl.to(currentView, { autoAlpha: 0, x: -30, duration: 0.18, ease: 'power2.in' }, T + 0.02)
      .fromTo(v, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power3.out' }, T + 0.15);
    currentView = v;
  }

  /* ---------- 2 · one place: down the sidebar, then ⌘K ---------- */
  {
    const T = 1 * SCENE;
    const items = $$('.wa-nav span');
    items.forEach((it, k) => {
      const at = T - 0.4 + k * 0.05;
      if (k === 0) moveTo(tl, spot(it, 0.4), at - 0.1, 0.1);
      else tl.to(cursor, { y: spot(it).y - 3, duration: 0.05 }, at);
      tl.to(ind, { y: it.offsetTop, duration: 0.05 }, at);
    });
    tl.to(ind, { y: home.offsetTop, duration: 0.15, ease: 'power2.out' }, T);
    const pal = $('.wa-palette');
    tl.from(pal, { scale: 0.9, y: 20, duration: 0.3, ease: 'back.out(1.6)' }, T + 0.2);
    type(tl, $('.wa-typed', pal), T + 0.45, 0.2);
    tl.from($$('.wa-res', pal), { autoAlpha: 0, y: 12, duration: 0.2, stagger: 0.06 }, T + 0.6);
    cls(tl, $('.wa-res', pal), 'sel', T + 0.9);
    moveTo(tl, spot($('.wa-res', pal), 0.8), T + 0.7, 0.3);
  }

  /* ---------- 3 · dashboards: count up, draw the live line ---------- */
  {
    const T = 2 * SCENE, v = view('reports');
    $$('.wa-count', v).forEach((el, k) => count(tl, el, T + 0.4 + k * 0.08));
    gsap.set($('.wa-line', v), { drawSVG: '0%' });
    tl.to($('.wa-line', v), { drawSVG: '100%', duration: 0.7, ease: 'power1.inOut' }, T + 0.4)
      .from($('.wa-area', v), { autoAlpha: 0, duration: 0.4 }, T + 0.7)
      .from($('.wa-dot', v), { scale: 0, transformOrigin: '50% 50%', duration: 0.2, ease: 'back.out(3)' }, T + 1.05);
  }

  /* ---------- 4 · spreadsheets: drag the file in, import it clean ---------- */
  {
    const T = 3 * SCENE, v = view('import');
    const file = $('.wa-file'), drop = $('.wa-drop', v);
    const from = { x: 240, y: 560 }, to = spot(drop);
    tl.set(file, { x: from.x, y: from.y, rotate: -8 }, T + 0.3)
      .to(file, { autoAlpha: 1, duration: 0.1 }, T + 0.3);
    moveTo(tl, { x: from.x + 40, y: from.y + 30 }, T + 0.25, 0.1);
    tl.to(file, { x: to.x - 110, y: to.y - 28, rotate: 3, duration: 0.4, ease: 'power2.inOut' }, T + 0.4);
    moveTo(tl, { x: to.x - 70, y: to.y + 2 }, T + 0.4, 0.4);
    tl.to(drop, { backgroundColor: '#E0E7FF', scale: 1.02, duration: 0.1 }, T + 0.7)
      .to(file, { autoAlpha: 0, scale: 0.6, duration: 0.12 }, T + 0.82)
      .to(drop, { backgroundColor: '#F5F6FF', scale: 1, duration: 0.1 }, T + 0.85)
      .from($('.wa-progress', v), { autoAlpha: 0, duration: 0.1 }, T + 0.85)
      .to($('.wa-progress b', v), { scaleX: 1, duration: 0.35, ease: 'power1.inOut' }, T + 0.9)
      .from($('.wa-progress em', v), { autoAlpha: 0, duration: 0.1 }, T + 1.2)
      .from($('.wa-table', v), { autoAlpha: 0, y: 16, duration: 0.2 }, T + 1.15)
      .from($$('.wa-table .wa-row:not(.head)', v), { autoAlpha: 0, x: -16, duration: 0.15, stagger: 0.05 }, T + 1.2);
  }

  /* ---------- 5 · roles: sign in, then flip a permission ---------- */
  {
    const T = 4 * SCENE, v = view('team');
    const card = $('.wa-signin', v), fields = $$('.wa-typed', card), btn = $('.wa-btn', card);
    tl.from(card, { scale: 0.85, y: 30, autoAlpha: 0, duration: 0.3, ease: 'back.out(1.5)' }, T + 0.2);
    type(tl, fields[0], T + 0.4, 0.25);
    type(tl, fields[1], T + 0.65, 0.15);
    moveTo(tl, spot(btn), T + 0.55, 0.25);
    click(tl, T + 0.82, spot(btn));
    tl.from($$('.wa-2fa i', card), { autoAlpha: 0, y: 8, duration: 0.08, stagger: 0.035 }, T + 0.86)
      .to($('.wa-modal', v), { autoAlpha: 0, duration: 0.15 }, T + 1.12);
    const flip = $('.wa-roles [data-flip]', v);
    moveTo(tl, spot(flip), T + 1.1, 0.15);
    click(tl, T + 1.27, spot(flip));
    cls(tl, flip, 'on', T + 1.28);
  }

  /* ---------- 6 · automation: the invoice runs the workflow ---------- */
  {
    const T = 5 * SCENE, v = view('flow');
    const nodes = $$('.wa-node', v), token = $('.wa-token', v);
    tl.from(nodes, { autoAlpha: 0, scale: 0.8, duration: 0.2, stagger: 0.07, ease: 'back.out(1.8)' }, T + 0.25)
      .from($('.wa-wires', v), { autoAlpha: 0, duration: 0.2 }, T + 0.5);
    gsap.set($$('.ck', v), { scale: 0 });
    const pts = [[280, 80], [470, 80], [600, 113], [600, 185], [470, 218], [280, 218]];
    tl.set(token, { x: pts[0][0], y: pts[0][1] }, T + 0.55).from(token, { autoAlpha: 0, scale: 0, duration: 0.08 }, T + 0.55);
    const done = [T + 0.6, T + 0.8, T + 1.02, T + 1.2];
    nodes.forEach((n, k) => { cls(tl, n, 'done', done[k]); tl.to($('.ck', n), { scale: 1, duration: 0.1, ease: 'back.out(3)' }, done[k]); });
    pts.slice(1).forEach(([x, y], k) => tl.to(token, { x, y, duration: 0.11 }, T + 0.62 + k * 0.115));
    tl.to(token, { autoAlpha: 0, duration: 0.05 }, T + 1.22)
      .fromTo($('.wa-toast'), { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.15, ease: 'back.out(2)', immediateRender: false }, T + 1.25)
      .to($('.wa-toast'), { autoAlpha: 0, duration: 0.1 }, 6 * SCENE - 0.3);
  }

  /* ---------- 7 · integrations: switch them on ---------- */
  {
    const T = 6 * SCENE, v = view('ints');
    const cards = $$('.wa-int', v);
    tl.from(cards, { autoAlpha: 0, y: 20, duration: 0.2, stagger: 0.05 }, T + 0.25);
    cards.forEach((c, k) => {
      const tg = $('.tg', c), at = T + 0.6 + k * 0.1;
      moveTo(tl, spot(tg), at - 0.08, 0.08);
      cls(tl, tg, 'on', at);
    });
    count(tl, $('.wa-count', v), T + 1.1, 0.4);
  }

  /* ---------- 8 · launch: deploy, and the address becomes real ---------- */
  {
    const T = 7 * SCENE, v = view('deploy');
    tl.to(cursor, { autoAlpha: 0, duration: 0.1 }, T);
    tl.from($('.wa-term', v), { autoAlpha: 0, y: 16, duration: 0.2 }, T + 0.25)
      .from($$('.wa-term p', v), { autoAlpha: 0, x: -12, duration: 0.12, stagger: 0.14 }, T + 0.35)
      .to(host, { scrambleText: { text: 'northwind.app', chars: 'abcdefghijklmnopqrstuvwxyz', speed: 0.8 }, duration: 0.3 }, T + 0.95);
    swap(tl, path, '/deploy', '', T + 0.95);
    tl.to($('.wa-live'), { autoAlpha: 1, duration: 0.01 }, T + 1.2)
      .fromTo($('.wa-live'), { scale: 0.5 }, { scale: 1, duration: 0.15, ease: 'back.out(3)' }, T + 1.2)
      .from($('.wa-golive', v), { autoAlpha: 0, scale: 0.7, duration: 0.25, ease: 'back.out(2)' }, T + 1.2)
      .to({}, { duration: 0.6 }, T + 1.45);                 // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + pinLength(chaps.length),
    pin: $('.wa-stage'),
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
