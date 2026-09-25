/* =====================================================================
   Websites page: browse the sample site.

   One browser window with a fictional café site in it, drawn at desktop
   size and scaled to fit, in its own column. Each chapter the camera inside
   the window glides and zooms to a section, the way a visitor would browse,
   and a Figma-style callout follows it to what matters; at the end it glides
   back to the top of the page as the site goes live.
     1 Overview   the page loads: bar, photo sharpens, nav appears (plays on load)
     2 Design     the logo is called out; a style guide slides in
     3 Speed      the hero reloads in a blink; the performance score fills to 100
     4 Menu       scroll to the menu; the cards rise in
     5 Search     scroll to the address; "coffee near me" finds the café
     6 Bookings   the booking form fills itself in; a request arrives
     7 Accessible scroll to the footer; focus rings tab through the links
     8 Launch     back to the top; the address goes live and it's published
   Pinned and scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

const section = document.getElementById('websiteJourney');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const win = $('.ws-window'), fit = $('.ws-fit'), site = $('.ws-site');
  const chaps = $$('.ws-chap');
  const progress = $('.sj-progress');
  progress.innerHTML = chaps.map((c) => `<li>${c.dataset.label}</li>`).join('');
  const steps = $$('li', progress);

  /* ---------- the window is drawn at 1440 × 904 and scaled to fit ---------- */
  const W = 1440, H = 904, BAR = 44, VIEW = 860;
  const size = () => {
    const col = $('.ws-side').clientWidth;
    const k = Math.min(col / W, (window.innerHeight * (window.innerWidth < 900 ? 0.34 : 0.66)) / H, 1);
    win.style.transform = `scale(${k})`;
    fit.style.width = `${W * k}px`;
    fit.style.height = `${H * k}px`;
  };
  size();
  window.addEventListener('resize', size);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    $$('.tw-field[data-text]').forEach((f) => { f.textContent = f.dataset.text; });
    return;
  }

  /* ---------- helpers ---------- */
  const type = (tl, el, at, dur) => {
    const txt = el.dataset.text, p = { n: 0 };
    el.textContent = '';
    tl.to(p, { n: txt.length, duration: dur, onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
  };
  // where an element sits on the page, in page pixels. Measured once, before any animation
  // moves things, and including CSS shifts like translateY(-50%).
  const rects = new Map();
  const onPage = (el) => {
    if (rects.has(el)) return rects.get(el);
    let x = 0, y = 0;
    for (let n = el; n && n !== site; n = n.offsetParent) {
      const m = new DOMMatrix(getComputedStyle(n).transform);
      x += n.offsetLeft + m.m41; y += n.offsetTop + m.m42;
    }
    const r = { x, y, w: el.offsetWidth, h: el.offsetHeight };
    rects.set(el, r);
    return r;
  };
  // the camera inside the window: frame an element (pad = breathing room, max = most zoom,
  // cx = where across the window its centre should sit), never showing past the page's edges
  const clampAxis = (t, size, view) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, t)));
  const frame = (el, pad = 1.15, max = 1.8, cx = W / 2, cy = VIEW / 2) => {
    const r = onPage(el), pageH = site.offsetHeight;
    const k = Math.max(1, Math.min(W / (r.w * pad), VIEW / (r.h * pad), max));
    return { scale: k, x: clampAxis(cx - (r.x + r.w / 2) * k, W * k, W), y: clampAxis(cy - (r.y + r.h / 2) * k, pageH * k, VIEW) };
  };
  const TOP = { scale: 1, x: 0, y: 0 };
  // the callout box around an element, wherever the camera is
  const markAt = (el, cam, grow = 10) => {
    const r = onPage(el);
    return { x: r.x * cam.scale + cam.x - grow, y: BAR + r.y * cam.scale + cam.y - grow, width: r.w * cam.scale + grow * 2, height: r.h * cam.scale + grow * 2 };
  };
  const SMOOTH = 'sine.inOut', OUT = 'power2.out';

  /* ---------- the page's sections and what each chapter points at ---------- */
  const logo = $('.tw-header .tw-logo'), hero = $('.tw-hero'), cards = $('.tw-cards'), visit = $('.tw-visit'),
    book = $('.tw-book'), footer = $('.tw-footer-inner');
  [logo, hero, cards, visit, book, footer, $('.tw-hero-copy'), ...$$('.tw-footer [data-focus]')].forEach(onPage);
  // where the camera is for each chapter: zoomed in on what that chapter is about
  const CAM = [TOP, frame(logo, 3, 1.8), frame($('.tw-hero-copy'), 1.35, 1.6, 560), frame(cards, 1.08), frame(visit, 1.1, 1.3, W / 2, 270),
    frame(book, 1.1, 1.5, 480), frame(footer, 1.1), TOP];
  const MARK = [null, [logo, 'Your logo'], [hero, 'Hero · 0.8 s'], [cards, 'Menu'], [visit, 'Hours + address'], [book, 'Booking form'], [footer, 'Footer'], null];

  /* ---------- starting state ---------- */
  const mark = $('.ws-mark'), markT = $('.ws-mark-t');
  gsap.set(chaps, { autoAlpha: 0, y: 40 });
  gsap.set(site, { transformOrigin: '0 0', ...TOP });
  gsap.set(mark, { autoAlpha: 0, ...markAt(logo, TOP) });
  $$('.tw-field[data-text]').forEach((f) => { f.textContent = ''; });

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

  /* ---------- 1 · the page loads (plays on load) ---------- */
  const heroImg = $('.tw-hero-img'), load = $('.tw-load i');
  intro.to(chaps[0], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0.1)
    .from(win, { autoAlpha: 0, y: 40, duration: 0.5, ease: 'power3.out' }, 0)
    .fromTo(load, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power1.inOut' }, 0.3)
    .fromTo(heroImg, { opacity: 0.2, filter: 'blur(16px)', scale: 1.06 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.5, ease: OUT }, 0.55)
    .from($$('.tw-header > *'), { opacity: 0, y: -10, duration: 0.25, stagger: 0.08, ease: OUT }, 0.4)
    .from($$('.tw-hero-copy > *'), { opacity: 0, y: 20, duration: 0.3, stagger: 0.08, ease: OUT }, 0.75)
    .to(load.parentElement, { opacity: 0, duration: 0.2 }, 0.95);

  /* ---------- every later chapter: the camera glides and zooms to it, the callout follows ---------- */
  for (let i = 1; i < chaps.length; i++) {
    const T = i * SCENE;
    tl.to(chaps[i - 1], { autoAlpha: 0, y: -30, duration: 0.2, ease: 'power2.in' }, T - 0.45)
      .to(chaps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, T + 0.1);
    tl.to(site, { ...CAM[i], duration: i === 7 ? 0.8 : 0.7, ease: SMOOTH }, T - 0.4);
    if (MARK[i]) {
      const [el, label] = MARK[i];
      tl.to(mark, { ...markAt(el, CAM[i]), autoAlpha: 1, duration: 0.7, ease: SMOOTH }, T - 0.4);
      const from = MARK[i - 1] ? MARK[i - 1][1] : label, p = { v: 0 };
      tl.to(p, { v: 1, duration: 0.01, onUpdate: () => { markT.textContent = p.v > 0.5 ? label : from; } }, T - 0.1);
    } else {
      tl.to(mark, { autoAlpha: 0, duration: 0.25 }, T - 0.35);
    }
  }
  // popups leave before the next chapter begins
  const shows = (el, i, from = { y: -16 }) => {
    const T = i * SCENE;
    tl.fromTo(el, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: 0.25, ease: OUT, immediateRender: false }, T + 0.3)
      .to(el, { opacity: 0, duration: 0.2 }, (i + 1) * SCENE - 0.45);
  };

  /* ---------- 2 · design: the style guide ---------- */
  shows($('.ws-guide'), 1, { x: 40 });
  tl.from($$('.ws-swatches i'), { scale: 0.4, opacity: 0, duration: 0.2, stagger: 0.07, ease: OUT }, SCENE + 0.5)
    .from($('.ws-font'), { opacity: 0, y: 10, duration: 0.2, ease: OUT }, SCENE + 0.8);

  /* ---------- 3 · speed: reload in a blink, score to 100 ---------- */
  {
    const T = 2 * SCENE;
    tl.fromTo(load.parentElement, { opacity: 1 }, { opacity: 1, duration: 0.01, immediateRender: false }, T + 0.2)
      .fromTo(load, { scaleX: 0 }, { scaleX: 1, duration: 0.25, ease: 'power1.inOut', immediateRender: false }, T + 0.2)
      .fromTo(heroImg, { opacity: 0.3, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.25, ease: OUT, immediateRender: false }, T + 0.3)
      .to(load.parentElement, { opacity: 0, duration: 0.1 }, T + 0.5);
    shows($('.ws-score'), 2, { x: 40 });
    const ring = $('.ws-score .fg'), n = $('.ws-score-n'), v = { n: 0 };
    gsap.set(ring, { drawSVG: '0%' });
    tl.to(ring, { drawSVG: '100%', duration: 0.6, ease: OUT }, T + 0.45)
      .to(v, { n: 100, duration: 0.6, ease: OUT, onUpdate: () => { n.textContent = Math.round(v.n); } }, T + 0.45);
  }

  /* ---------- 4 · menu: the cards rise in ---------- */
  tl.from($$('.tw-card'), { opacity: 0, y: 50, duration: 0.3, stagger: 0.08, ease: OUT }, 3 * SCENE + 0.15)
    .from($$('.tw-price em'), { opacity: 0, y: 10, duration: 0.2, stagger: 0.06, ease: OUT }, 3 * SCENE + 0.55);

  /* ---------- 5 · search: "coffee near me" finds the café ---------- */
  shows($('.ws-serp'), 4);
  type(tl, $('.ws-typed'), 4 * SCENE + 0.4, 0.3);
  tl.from($('.ws-serp-r.top'), { opacity: 0, y: 12, duration: 0.2, ease: OUT }, 4 * SCENE + 0.75)
    .from($('.ws-serp-r.dim'), { opacity: 0, duration: 0.2 }, 4 * SCENE + 0.9)
    .from($('.tw-open'), { scale: 0.6, opacity: 0, duration: 0.2, ease: OUT }, 4 * SCENE + 0.95);

  /* ---------- 6 · bookings: the form fills itself in ---------- */
  {
    const T = 5 * SCENE;
    $$('.tw-field[data-text]').forEach((f, k) => type(tl, f, T + 0.3 + k * 0.14, 0.12));
    tl.fromTo($('.tw-book-btn'), { scale: 1 }, { keyframes: { scale: [1, 0.94, 1] }, duration: 0.12, immediateRender: false }, T + 0.9);
    // the request arrives right after the press
    tl.fromTo($('.ws-toast'), { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.2, ease: OUT, immediateRender: false }, T + 1.0)
      .to($('.ws-toast'), { opacity: 0, duration: 0.2 }, 6 * SCENE - 0.45);
  }

  /* ---------- 7 · accessible: focus rings tab through the footer ---------- */
  {
    const T = 6 * SCENE, ring = $('.ws-ring'), stops = $$('.tw-footer [data-focus]');
    shows($('.ws-a11y'), 6, { y: -10 });
    const first = markAt(stops[0], CAM[6], 0);
    tl.set(ring, first, T + 0.35).to(ring, { opacity: 1, duration: 0.08 }, T + 0.35);
    stops.forEach((s, k) => { if (k) tl.to(ring, { ...markAt(s, CAM[6], 0), duration: 0.08, ease: SMOOTH }, T + 0.35 + k * 0.1); });
    tl.to(ring, { opacity: 0, duration: 0.15 }, 7 * SCENE - 0.45);
  }

  /* ---------- 8 · launch: back to the top, the address goes live ---------- */
  {
    const T = 7 * SCENE, addr = $('.ws-addr'), live = $('.tw-live');
    // the preview address becomes the real one
    const p = { n: 0 }, full = 'yourbusiness.com', preview = addr.textContent;
    tl.to(p, { n: full.length, duration: 0.35, onUpdate: () => { addr.textContent = p.n < 0.5 ? preview : full.slice(0, Math.round(p.n)); } }, T + 0.5)
      .fromTo(live, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.15, ease: OUT, immediateRender: false }, T + 0.9)
      .fromTo($('.ws-published'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.25, ease: OUT, immediateRender: false }, T + 1.0)
      .to({}, { duration: 0.6 }, T + 1.45);                  // hold on the finish
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (chaps.length * 1.8 + 0.4),
    pin: $('.ws-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__flip = tl;
}
