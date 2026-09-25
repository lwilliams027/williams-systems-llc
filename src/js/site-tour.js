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
  const WORLD = () => ({ w: world.offsetWidth, h: world.offsetHeight });

  // Where each stop sits in the sample site (design pixels), and how much room to leave around it.
  // The stops follow the captions, top to bottom of the sample page.
  const PAD = { intro: 1, brand: 1.5, hero: 1, favs: 1, visit: 1.06, book: 1.1, footer: 1, site: 1.06 };
  const STOPS = caps.map((c) => {
    const n = c.dataset.stop;
    return { name: n, sel: n === 'site' || n === 'intro' ? null : `[data-stop="${n}"]`, pad: PAD[n] || 1.05 };
  });
  const N = STOPS.length;
  const SEG = 1;                                   // one stop per unit of timeline
  const stopAt = (name) => STOPS.findIndex((st) => st.name === name) * SEG;   // when a stop begins

  /** Layout box of an element in the sample site's own coordinates. */
  const boxOf = (el, root = world) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  /** The part of the screen the camera frames into (beside or above the caption). */
  const frame = () => ({ x: 0, y: 0, w: viewport.clientWidth, h: viewport.clientHeight });

  /** Camera settings that frame stop i: centre point and log of the scale. */
  const view = (i) => {
    const s = STOPS[i];
    const r = s.sel ? boxOf($(s.sel, world)) : { x: 0, y: 0, ...WORLD() };
    const f = frame();
    const W = WORLD();
    // The final stop pulls back to show the whole page.
    if (s.name === 'site') {
      const scale = Math.min(f.w / (W.w * s.pad), f.h / (W.h * s.pad));
      return { cx: W.w / 2, cy: W.h / 2, z: Math.log(scale) };
    }
    // Every other stop is the site as a browser shows it: always full width,
    // scrolled so the section sits in view (the header stop is the top of the page).
    const k = f.w / W.w, hh = f.h / (2 * k);
    const clampTo = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    const cy = s.name === 'intro' || s.name === 'brand' ? hh : r.y + Math.min(r.h, f.h / k) / 2;
    return { cx: W.w / 2, cy: clampTo(cy, hh, W.h - hh), z: Math.log(k) };
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
  const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => { render(); setDot(); } });
  let lastDot = -1;
  const setDot = () => {
    const i = Math.min(N - 1, Math.max(0, Math.floor(tl.time() / SEG + 0.08)));
    if (i === lastDot) return;
    lastDot = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };

  // Start: the page as a browser shows it.
  Object.assign(cam, view(0));
  tl.set(cam, { cx: () => view(0).cx, cy: () => view(0).cy, z: () => view(0).z }, 0);

  // Camera moves between stops, and captions swap as the camera arrives.
  for (let i = 0; i < N; i++) {
    const at = i * SEG;
    if (i > 0) {
      tl.to(cam, { cx: () => view(i).cx, cy: () => view(i).cy, z: () => view(i).z, duration: 0.42 * SEG, ease: 'power2.inOut' }, at - 0.3 * SEG);
      tl.to(caps[i - 1], { autoAlpha: 0, y: -24, duration: 0.12 * SEG, ease: 'power2.in' }, at - 0.18 * SEG);
    }
    if (i > 0) tl.fromTo(caps[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16 * SEG, ease: 'power3.out' }, at);
  }

  // Header: the logo and brand colours get a highlight ring.
  const logo = $('.tw-header .tw-logo', world);
  tl.fromTo(logo, { boxShadow: '0 0 0 0px rgba(124,134,255,0)' }, { boxShadow: '0 0 0 6px rgba(124,134,255,0.55)', duration: 0.12, immediateRender: false }, stopAt('brand') + 0.06)
    .to(logo, { boxShadow: '0 0 0 0px rgba(124,134,255,0)', duration: 0.12 }, stopAt('brand') + SEG - 0.3);

  // Visit section: the business shows up as the top search result.
  const serp = $('.tour-serp');
  tl.fromTo(serp, { autoAlpha: 0, y: -18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14, ease: 'power3.out' }, stopAt('visit') + 0.12)
    .to(serp, { autoAlpha: 0, y: -12, duration: 0.1 }, stopAt('visit') + SEG - 0.24);

  // Hero: the page loads, the photo sharpens in.
  const heroImg = $('.tw-hero-img', world);
  const load = $('.tw-load', world);
  tl.fromTo($('.tw-load i', world), { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power1.inOut', immediateRender: false }, stopAt('hero') + 0.04)
    .fromTo(heroImg, { opacity: 0.25, scale: 1.08, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power2.out', immediateRender: false }, stopAt('hero') + 0.04)
    .to(load, { autoAlpha: 0, duration: 0.08 }, stopAt('hero') + 0.4);

  // Menu: the item cards rise into place one after another.
  tl.fromTo($$('.tw-card', world), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, stagger: 0.06, ease: 'power3.out', immediateRender: false }, stopAt('favs') - 0.1);

  // Booking form: the fields fill in, the request is sent, a notification arrives.
  $$('.tw-field', world).forEach((field, k) => {
    const text = field.dataset.fill;
    const typed = { n: 0 };
    tl.to(typed, { n: text.length, duration: 0.1, onUpdate: () => { field.textContent = text.slice(0, Math.round(typed.n)); } }, stopAt('book') + 0.06 + k * 0.08);
  });
  const toast = $('.tour-toast');
  tl.fromTo($('.tw-book-btn', world), { scale: 1 }, { keyframes: { scale: [1, 0.93, 1] }, duration: 0.1 }, stopAt('book') + 0.44)
    .fromTo(toast, { autoAlpha: 0, y: -20, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.12, ease: 'back.out(1.8)' }, stopAt('book') + 0.52)
    .to(toast, { autoAlpha: 0, y: -12, duration: 0.1 }, stopAt('book') + SEG - 0.24);

  // Footer: a keyboard focus ring steps through the links.
  const footer = $('.tw-footer', world);
  const focus = $('.tw-focus', world);
  const links = $$('.tw-footer-links span, .tw-signup span', world);
  const place = (el) => { const b = boxOf(el, footer); return { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4 }; };
  tl.set(focus, { ...place(links[links.length - 2]), opacity: 0 }, stopAt('footer'));
  tl.to(focus, { opacity: 1, duration: 0.04 }, stopAt('footer') + 0.08);
  [...links.slice(-2), ...links.slice(0, -2)].forEach((el, k) => {
    tl.to(focus, { ...place(el), duration: 0.06, ease: 'power2.inOut' }, stopAt('footer') + 0.12 + k * 0.08);
  });
  tl.to(focus, { opacity: 0, duration: 0.05 }, stopAt('footer') + SEG - 0.22);

  // The whole site: it goes live.
  tl.fromTo($('.tw-live'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)' }, stopAt('site') + 0.2)
    .to({}, { duration: 0.5 }, stopAt('site') + 0.3);     // hold on the finished site

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
