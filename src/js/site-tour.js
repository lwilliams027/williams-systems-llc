/* =====================================================================
   Website tour (websites.html)

   The section is pinned while you scroll, and a "camera" glides across a
   real client site (Face & Mane): logo and menu → Book Now → video hero →
   trust section → treatment chooser → before-and-after sliders → footer,
   then pulls back to show the site. A glowing outline marks what each
   caption is talking about.

   The camera is a transform on #tourWorld (translate + scale). Each stop is
   an invisible .tw-stop box placed over the page in page pixels.
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

  const viewport = $('.tour-viewport');
  const world = $('#tourWorld');
  const stops = $$('.tw-stop', world);
  const caps = $$('.tour-cap');
  const dots = $$('.tour-dots li');
  const frameBox = $('.tw-frame', world);
  const N = stops.length;

  // Sharp tiles on desktop, lighter ones on phones (they never zoom in as far).
  const set = window.innerWidth >= 900 ? 'd' : 'm';
  $$('img[data-tile]', world).forEach((img) => {
    img.decoding = 'async';
    img.src = `${import.meta.env.BASE_URL}tour/fnm/${set}${img.dataset.tile}.jpg`;
  });

  const boxOf = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

  /** The part of the screen the camera frames into (beside or above the caption). */
  const frame = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (section.classList.contains('is-static')) return { x: 16, y: 16, w: w - 32, h: h - 32 };
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76) + 16;
    if (w < 900) return { x: 12, y: top, w: w - 24, h: h * 0.5 - top };
    const left = Math.max(w * 0.36, 460);
    return { x: left, y: top + 8, w: w - left - 40, h: h - top - 48 };
  };

  /** Camera settings that frame stop i: centre point and log of the scale. */
  const view = (i) => {
    const r = boxOf(stops[i]);
    const f = frame();
    const pad = r.w < 800 ? 1.18 : 1.04;
    const scale = Math.min(f.w / (r.w * pad), f.h / (r.h * pad), 2);
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, z: Math.log(scale) };
  };

  const cam = { cx: 0, cy: 0, z: 0 };
  const render = () => {
    const f = frame();
    const s = Math.exp(cam.z);
    world.style.transform = `translate(${f.x + f.w / 2 - cam.cx * s}px, ${f.y + f.h / 2 - cam.cy * s}px) scale(${s})`;
  };
  const frameAt = (i, inset = 10) => { const r = boxOf(stops[i]); return { left: r.x + inset, top: r.y + inset, width: r.w - inset * 2, height: r.h - inset * 2 }; };

  // Reduced motion: a still picture of the site and every caption, no pinning.
  if (reduced) {
    section.classList.add('is-static');
    Object.assign(cam, view(N - 1));
    render();
    gsap.set($('.tw-live', world), { opacity: 1 });
    window.addEventListener('resize', () => { Object.assign(cam, view(N - 1)); render(); });
    return;
  }

  /* ------------------------------------------------------------ timeline */
  const SEG = 1;
  const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: () => { render(); setDot(); } });
  let lastDot = -1;
  const setDot = () => {
    const i = Math.min(N - 1, Math.max(0, Math.floor(tl.time() / SEG + 0.08)));
    if (i === lastDot) return;
    lastDot = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };

  // Start: close on the logo, easing back to frame the brand and menu.
  Object.assign(cam, view(0));
  tl.fromTo(cam,
    { cx: () => view(0).cx - 160, cy: () => view(0).cy, z: () => view(0).z + 0.35 },
    { cx: () => view(0).cx, cy: () => view(0).cy, z: () => view(0).z, duration: 0.45, ease: 'power2.out' }, 0)
    .fromTo(frameBox, { ...frameAt(0, 4), opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.3);

  for (let i = 0; i < N; i++) {
    const at = i * SEG;
    const last = i === N - 1;
    if (i > 0) {
      tl.to(cam, { cx: () => view(i).cx, cy: () => view(i).cy, z: () => view(i).z, duration: 0.42 * SEG, ease: 'power2.inOut' }, at - 0.3 * SEG);
      // the outline follows the camera to the next thing (and steps away for the final pull-back)
      tl.to(frameBox, last ? { opacity: 0, duration: 0.12 } : { ...frameAt(i, stops[i].offsetWidth < 800 ? 4 : 14), duration: 0.42 * SEG, ease: 'power2.inOut' }, at - 0.3 * SEG);
      tl.to(caps[i - 1], { autoAlpha: 0, y: -24, duration: 0.12 * SEG, ease: 'power2.in' }, at - 0.18 * SEG);
    }
    tl.fromTo(caps[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16 * SEG, ease: 'power3.out' }, i === 0 ? 0.05 : at);
  }

  // Book Now: the outline gives the button a little pulse.
  tl.to(frameBox, { keyframes: { scale: [1, 1.06, 1] }, transformOrigin: '50% 50%', duration: 0.2 }, 1 * SEG + 0.2);

  // Final: it's live.
  tl.fromTo($('.tw-live', world), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)' }, (N - 1) * SEG + 0.2)
    .to({}, { duration: 0.5 }, (N - 1) * SEG + 0.3);   // hold on the finished site

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * N * 1.1,
    pin: $('.tour-stage'),
    scrub: 0.7,
    animation: tl,
    invalidateOnRefresh: true,
    onRefresh: render,
  });
  render();
  setDot();
  if (import.meta.env.DEV) window.__tour = tl;   // for tuning in the console
}
