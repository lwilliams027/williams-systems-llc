/* =====================================================================
   Mobile apps page: use the app.

   A phone with a fictional class-booking app (Pulse Studio). Each chapter
   you use it, with a fingertip showing every touch:
     1 Overview      the phone rises, the app opens from its splash (plays on load)
     2 Fast/smooth   a finger scrolls the home screen
     3 Two taps      open a class, tap a time (1), tap Book (2)
     4 Payments      the payment sheet slides up; Face ID confirms; booked
     5 Notifications the lock screen; a reminder drops in
     6 Both stores   an Android phone joins; App Store "Get" and Play "Install" run
     7 Launch        both phones on the home screen, with the store badges
   The camera tilts and zooms around the phones. Pinned, scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('mobileJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scene = $('.mo-scene'), fit = $('.mo-fit'), cam = $('.mo-cam');
  const chaps = $$('.mo-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- drawn at 860 × 900 and scaled to fit ---------- */
  const W = 860, H = 900;
  const size = () => {
    const col = $('.mo-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.4 : 0.7)) / H, 1);
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
  const swap = (tl, el, from, to, at) => {
    const p = { v: 0 };
    tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { el.textContent = p.v > 0.5 ? to : from; } }, at);
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  /* ---------- the phones and screens ---------- */
  const A = $('.mo-phone[data-p="a"]'), B = $('.mo-phone[data-p="b"]');
  const screenA = $('.mo-screen', A);
  const scr = (name) => $(`.mo-${name}`);
  const touch = $('.mo-touch');
  // where something is on the iPhone's screen (screen pixels)
  const spot = (el, dy = 0) => {
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2;
    for (let n = el; n && n !== screenA; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y: y + dy };
  };
  const tap = (tl, el, at, dy = 0) => {
    const p = spot(el, dy);
    tl.to(touch, { x: p.x, y: p.y, opacity: 1, duration: 0.18, ease: SMOOTH }, at - 0.18)
      .to(touch, { keyframes: { scale: [1, 0.75, 1] }, duration: 0.12 }, at)
      .fromTo(el, { scale: 1 }, { keyframes: { scale: [1, 0.96, 1] }, duration: 0.12, immediateRender: false }, at);
  };

  // the camera for each chapter: tilt and zoom around the phones
  const CAM = [
    { rotateY: -14, rotateX: 5, scale: 1, x: 0, y: 0 },
    { rotateY: 10, rotateX: 3, scale: 1.02, x: 0, y: 0 },
    { rotateY: -8, rotateX: 2, scale: 1.03, x: 0, y: 0 },
    { rotateY: 0, rotateX: 12, scale: 1.03, x: 0, y: 0 },
    { rotateY: 12, rotateX: 4, scale: 1, x: 0, y: 0 },
    { rotateY: 0, rotateX: 0, scale: 0.95, x: 0, y: 0 },
    { rotateY: -4, rotateX: 3, scale: 0.9, x: 0, y: -24 },
  ];

  /* ---------- starting state ---------- */
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set($$('.mo-scr'), { autoAlpha: 0 });
  gsap.set([scr('splash'), scr('play')], { autoAlpha: 1 });
  gsap.set(B, { autoAlpha: 0 });
  gsap.set($('.mo-sheet'), { yPercent: 115 });
  gsap.set(touch, { x: 200, y: 700 });
  gsap.set(cam, { transformOrigin: '50% 50%', ...CAM[0] });
  gsap.set($$('.mo-faceid path'), { drawSVG: '0%' });
  gsap.set($('.mo-get-ring circle'), { drawSVG: '0%' });

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

  /* ---------- 1 · the phone rises, the app opens (plays on load) ---------- */
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(A, { autoAlpha: 0, y: 140, rotateX: 30, duration: 0.7, ease: 'power3.out' }, 0)
    .from($('.mo-splash .mo-icon'), { scale: 0.7, opacity: 0, duration: 0.4, ease: OUT }, 0.35)
    .to(scr('splash'), { autoAlpha: 0, duration: 0.25 }, 1.0)
    .to(scr('home'), { autoAlpha: 1, duration: 0.25 }, 1.0)
    .from($$('.mo-feed > *'), { opacity: 0, y: 24, duration: 0.25, stagger: 0.05, ease: OUT }, 1.05);

  /* ---------- every later chapter: new words, the camera moves ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1)
      .to(cam, { ...CAM[i], duration: 0.8, ease: SMOOTH }, T - 0.45);
  }

  /* ---------- 2 · fast and smooth: a finger scrolls the home screen ---------- */
  {
    const T = SCENE, feed = $('.mo-feed');
    tl.fromTo(touch, { x: 205, y: 690 }, { opacity: 1, duration: 0.1, immediateRender: false }, T + 0.15)
      .to(touch, { y: 330, duration: 0.55, ease: OUT }, T + 0.25)
      .to(feed, { y: -210, duration: 0.7, ease: OUT }, T + 0.25)
      .to(touch, { opacity: 0, duration: 0.12 }, T + 0.85)
      .to(feed, { y: 0, duration: 0.35, ease: SMOOTH }, 2 * SCENE - 0.45);   // back to the top before the next tap
  }

  /* ---------- 3 · book in two taps ---------- */
  {
    const T = 2 * SCENE, home = scr('home'), detail = scr('detail');
    tap(tl, $('.mo-next'), T + 0.15);
    tl.set(detail, { autoAlpha: 1 }, T + 0.25)
      .fromTo(detail, { xPercent: 100 }, { xPercent: 0, duration: 0.35, ease: 'power3.out', immediateRender: false }, T + 0.25)
      .to(home, { xPercent: -30, opacity: 0.4, duration: 0.35, ease: 'power3.out' }, T + 0.25)
      .set(home, { autoAlpha: 0 }, T + 0.6);
    const slot = $('.mo-slots .t7'), btn = $('.mo-btn');
    tap(tl, slot, T + 0.8);
    flag(tl, slot, 'on', T + 0.82);
    tl.fromTo($('.mo-tap.t1'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.15, ease: OUT, immediateRender: false }, T + 0.84);
    tap(tl, btn, T + 1.15);
    tl.fromTo($('.mo-tap.t2'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.15, ease: OUT, immediateRender: false }, T + 1.19)
      .to([$('.mo-tap.t1'), $('.mo-tap.t2'), touch], { opacity: 0, duration: 0.15 }, 3 * SCENE - 0.45);
  }

  /* ---------- 4 · payments: the sheet, Face ID, booked ---------- */
  {
    const T = 3 * SCENE, sheet = $('.mo-sheet'), fid = $('.mo-faceid');
    tl.to($('.mo-dim'), { opacity: 1, duration: 0.3 }, T + 0.05)
      .to(sheet, { yPercent: 0, duration: 0.4, ease: 'power3.out' }, T + 0.05)
      .from($('.mo-booked'), { opacity: 0, duration: 0.01 }, T)                  // hidden until it's paid
      .to($$('path', fid), { drawSVG: '100%', duration: 0.35, stagger: 0.08, ease: SMOOTH }, T + 0.45)
      .to($('svg', fid), { stroke: '#30D158', duration: 0.15 }, T + 0.9)
      .to(fid, { color: '#30D158', duration: 0.15 }, T + 0.9);
    swap(tl, $('.mo-fid-t'), 'Confirm with Face ID', 'Paid ✓', T + 0.92);
    tl.fromTo($('.mo-booked'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2, ease: OUT, immediateRender: false }, T + 1.0);
  }

  /* ---------- 5 · notifications: the lock screen ---------- */
  {
    const T = 4 * SCENE;
    tl.to($('.mo-sheet'), { yPercent: 115, duration: 0.3, ease: 'power2.in' }, T - 0.4)
      .to($('.mo-dim'), { opacity: 0, duration: 0.3 }, T - 0.4)
      .to(scr('detail'), { autoAlpha: 0, duration: 0.3 }, T - 0.15)
      .to(scr('lock'), { autoAlpha: 1, duration: 0.3 }, T - 0.15)
      .from($('.mo-note.n2'), { opacity: 0, duration: 0.2 }, T + 0.15)
      .from($('.mo-note.n1'), { y: -140, opacity: 0, duration: 0.35, ease: 'power3.out' }, T + 0.45);
  }

  /* ---------- 6 · both stores: Android joins, both install ---------- */
  {
    const T = 5 * SCENE;
    tl.to(A, { x: -215, duration: 0.75, ease: SMOOTH }, T - 0.4)
      .to(B, { x: 215, autoAlpha: 1, duration: 0.75, ease: SMOOTH }, T - 0.4)
      .to(scr('lock'), { autoAlpha: 0, duration: 0.3 }, T - 0.1)
      .to(scr('appstore'), { autoAlpha: 1, duration: 0.3 }, T - 0.1);
    const get = $('.mo-get');
    tap(tl, get, T + 0.4);
    tl.to($('em', get), { opacity: 0, duration: 0.08 }, T + 0.45)
      .to($('.mo-get-ring'), { opacity: 1, duration: 0.08 }, T + 0.45)
      .to($('.mo-get-ring circle'), { drawSVG: '100%', duration: 0.45, ease: SMOOTH }, T + 0.5)
      .to($('.mo-get-ring'), { opacity: 0, duration: 0.08 }, T + 0.97)
      .to($('em', get), { opacity: 1, duration: 0.08 }, T + 0.98)
      .to(touch, { opacity: 0, duration: 0.1 }, T + 0.6)
      .to($('.mo-bar'), { scaleX: 1, duration: 0.5, ease: SMOOTH }, T + 0.45);
    swap(tl, $('em', get), 'GET', 'OPEN', T + 0.97);
    swap(tl, $('.mo-install em'), 'Install', 'Open', T + 0.97);
  }

  /* ---------- 7 · launch: both on the home screen ---------- */
  {
    const T = 6 * SCENE;
    tl.to(scr('appstore'), { autoAlpha: 0, duration: 0.3 }, T - 0.15)
      .set(scr('home'), { xPercent: 0, opacity: 1 }, T - 0.15)
      .to(scr('home'), { autoAlpha: 1, duration: 0.3 }, T - 0.15)
      .to(scr('play'), { autoAlpha: 0, duration: 0.3 }, T - 0.15)
      .to(scr('ahome'), { autoAlpha: 1, duration: 0.3 }, T - 0.15)
      .to($('.mo-badges'), { opacity: 1, duration: 0.3, ease: OUT }, T + 0.35)
      .from($$('.mo-badges span'), { y: 16, duration: 0.3, stagger: 0.08, ease: OUT }, T + 0.35)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.mo-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
