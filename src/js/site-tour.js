/* =====================================================================
   Website tour (websites.html)

   The section is pinned while you scroll, and a "camera" glides across one
   sample website: header → sidebar → hero → menu → booking form → footer,
   then pulls back to show the whole site. Each stop has a caption and a
   small demonstration (search result, loading, editing, a booking, focus).

   The camera is a transform on #tourWorld: translate + scale. Stops are the
   real layout boxes of elements marked data-stop, so they stay correct if
   the sample site's markup changes.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const section = document.getElementById('tour');
if (section) initTour();

function initTour() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('.tour-stage');
  const viewport = $('.tour-viewport');
  const world = $('#tourWorld');
  const caps = $$('.tour-cap');
  const dots = $$('.tour-dots li');
  const WORLD = { w: world.offsetWidth, h: world.offsetHeight };

  // Where each stop sits in the sample site (design pixels), and how much room to leave around it.
  const STOPS = [
    { sel: '[data-stop="brand"]', pad: 1.14 },
    { sel: '[data-stop="visit"]', pad: 1.1 },
    { sel: '[data-stop="hero"]', pad: 1.03 },
    { sel: '[data-stop="favs"]', pad: 1.03 },
    { sel: '[data-stop="book"]', pad: 1.1 },
    { sel: '[data-stop="footer"]', pad: 1.03 },
    { sel: null, pad: 1.04 },                   // the whole site
  ];
  const N = STOPS.length;

  /** Layout box of an element in the sample site's own coordinates. */
  const boxOf = (el, root = world) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  /** The part of the screen the camera frames into (beside or above the caption). */
  const frame = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (section.classList.contains('is-static')) return { x: 16, y: 16, w: w - 32, h: h - 32 };
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76) + 16;
    if (w < 900) return { x: 12, y: top, w: w - 24, h: h * 0.52 - top };
    const left = Math.max(w * 0.36, 460);
    return { x: left, y: top + 8, w: w - left - 40, h: h - top - 48 };
  };

  /** Camera settings that frame stop i: centre point and log of the scale. */
  const view = (i) => {
    const s = STOPS[i];
    const r = s.sel ? boxOf($(s.sel, world)) : { x: 0, y: 0, ...WORLD };
    const f = frame();
    const scale = Math.min(f.w / (r.w * s.pad), f.h / (r.h * s.pad), 2.4);
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, z: Math.log(scale) };
  };

  const cam = { cx: 0, cy: 0, z: 0 };
  const render = () => {
    const f = frame();
    const s = Math.exp(cam.z);
    world.style.transform = `translate(${f.x + f.w / 2 - cam.cx * s}px, ${f.y + f.h / 2 - cam.cy * s}px) scale(${s})`;
  };

  // Reduced motion: a still picture of the whole site and every caption, no pinning.
  if (reduced) {
    section.classList.add('is-static');
    Object.assign(cam, view(N - 1));
    render();
    gsap.set($('.tw-live'), { opacity: 1 });
    window.addEventListener('resize', () => { Object.assign(cam, view(N - 1)); render(); });
    return;
  }

  /* ------------------------------------------------------------ timeline */
  const SEG = 1;                                   // one stop per unit of timeline
  const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => { render(); setDot(); } });
  let lastDot = -1;
  const setDot = () => {
    const i = Math.min(N - 1, Math.max(0, Math.floor(tl.time() / SEG + 0.08)));
    if (i === lastDot) return;
    lastDot = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };

  // Start: close on the logo, easing back to frame the header.
  Object.assign(cam, view(0));
  tl.fromTo(cam,
    { cx: () => view(0).cx - 140, cy: () => view(0).cy, z: () => view(0).z + 0.4 },
    { cx: () => view(0).cx, cy: () => view(0).cy, z: () => view(0).z, duration: 0.45, ease: 'power2.out' }, 0);

  // Camera moves between stops, and captions swap as the camera arrives.
  for (let i = 0; i < N; i++) {
    const at = i * SEG;
    if (i > 0) {
      tl.to(cam, { cx: () => view(i).cx, cy: () => view(i).cy, z: () => view(i).z, duration: 0.42 * SEG, ease: 'power2.inOut' }, at - 0.3 * SEG);
      tl.to(caps[i - 1], { autoAlpha: 0, y: -24, duration: 0.12 * SEG, ease: 'power2.in' }, at - 0.18 * SEG);
    }
    tl.fromTo(caps[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16 * SEG, ease: 'power3.out' }, i === 0 ? 0.05 : at);
  }

  // Stop 2 · sidebar: the business shows up as the top search result.
  const serp = $('.tour-serp');
  tl.fromTo(serp, { autoAlpha: 0, y: -18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14, ease: 'power3.out' }, 1 * SEG + 0.12)
    .to(serp, { autoAlpha: 0, y: -12, duration: 0.1 }, 2 * SEG - 0.24);

  // Stop 3 · hero: the page loads, the photo sharpens in.
  const heroImg = $('.tw-hero-img', world);
  const load = $('.tw-load', world);
  gsap.set(heroImg, { opacity: 0.25, scale: 1.08, filter: 'blur(14px)' });
  tl.fromTo($('.tw-load i', world), { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power1.inOut' }, 2 * SEG + 0.04)
    .to(heroImg, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power2.out' }, 2 * SEG + 0.16)
    .to(load, { autoAlpha: 0, duration: 0.08 }, 2 * SEG + 0.4);

  // Stop 4 · menu: an editor opens and the price changes on the live page.
  const cms = $('.tour-cms');
  tl.fromTo(cms, { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.14, ease: 'power3.out' }, 3 * SEG + 0.08)
    .to($$('.tw-old'), { autoAlpha: 0, duration: 0.06 }, 3 * SEG + 0.32)
    .to($$('.tw-new'), { autoAlpha: 1, duration: 0.06 }, 3 * SEG + 0.34)
    .fromTo($('.tour-cms-btn'), { scale: 1 }, { keyframes: { scale: [1, 0.94, 1] }, duration: 0.1 }, 3 * SEG + 0.42)
    .fromTo($('.tw-badge', world), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)' }, 3 * SEG + 0.48)
    .to(cms, { autoAlpha: 0, x: 20, duration: 0.1 }, 4 * SEG - 0.24);

  // Stop 5 · booking form: the fields fill in, the request is sent, a notification arrives.
  $$('.tw-field', world).forEach((field, k) => {
    const text = field.dataset.fill;
    const typed = { n: 0 };
    tl.to(typed, { n: text.length, duration: 0.1, onUpdate: () => { field.textContent = text.slice(0, Math.round(typed.n)); } }, 4 * SEG + 0.06 + k * 0.08);
  });
  const toast = $('.tour-toast');
  tl.fromTo($('.tw-book-btn', world), { scale: 1 }, { keyframes: { scale: [1, 0.93, 1] }, duration: 0.1 }, 4 * SEG + 0.44)
    .fromTo(toast, { autoAlpha: 0, y: -20, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.12, ease: 'back.out(1.8)' }, 4 * SEG + 0.52)
    .to(toast, { autoAlpha: 0, y: -12, duration: 0.1 }, 5 * SEG - 0.24);

  // Stop 6 · footer: a keyboard focus ring steps through the links.
  const footer = $('.tw-footer', world);
  const focus = $('.tw-focus', world);
  const links = $$('.tw-footer-links span, .tw-signup span', world);
  const place = (el) => { const b = boxOf(el, footer); return { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4 }; };
  tl.set(focus, { ...place(links[links.length - 2]), opacity: 0 }, 5 * SEG);
  tl.to(focus, { opacity: 1, duration: 0.04 }, 5 * SEG + 0.08);
  [...links.slice(-2), ...links.slice(0, -2)].forEach((el, k) => {
    tl.to(focus, { ...place(el), duration: 0.06, ease: 'power2.inOut' }, 5 * SEG + 0.12 + k * 0.08);
  });
  tl.to(focus, { opacity: 0, duration: 0.05 }, 6 * SEG - 0.22);

  // Stop 7 · the whole site: it goes live.
  tl.fromTo($('.tw-live', world), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)' }, 6 * SEG + 0.2)
    .to({}, { duration: 0.5 }, 6 * SEG + 0.3);     // hold on the finished site

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * N * 1.15,
    pin: stage,
    scrub: 0.7,
    animation: tl,
    invalidateOnRefresh: true,
    onRefresh: render,
  });
  render();
  setDot();
  if (import.meta.env.DEV) window.__tour = tl;   // for tuning in the console
}
