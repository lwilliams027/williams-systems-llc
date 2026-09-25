/* =====================================================================
   Product tour (websites.html and the other product pages)

   The section is pinned while you scroll, and a "camera" glides across one
   sample product (#tourWorld). Each caption (.tour-cap[data-stop]) is a
   stop: the camera frames the element with the same data-stop, then the
   next caption swaps in. "intro" shows the top of the product; "site"
   pulls back to show all of it.

   Small demonstrations are declared in the markup, so every page can have
   its own. An element with data-anim runs at the stop it sits inside (or
   the stop named in data-at), data-delay units after the camera arrives:
     rise   its children rise into place one after another
     grow   its children grow up from the bottom (chart bars)
     pop    it pops in
     type   its text types out (from data-fill)
     count  counts up to data-count (data-prefix / data-suffix / data-dec)
     check  its children get ticked one after another (.done)
     press  it's pressed like a button
     load   a loading bar runs and its image sharpens in
     focus  a focus ring (.tw-focus) steps through its [data-focus] items
   Overlays outside the product (.tour-pop[data-at]) show during their stop.
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
  const live = $('.tw-live');
  const WORLD = () => ({ w: world.offsetWidth, h: world.offsetHeight });

  const STOPS = caps.map((c) => {
    const n = c.dataset.stop;
    return { name: n, sel: n === 'site' || n === 'intro' ? null : `[data-stop="${n}"]`, pad: parseFloat(c.dataset.pad) || 1.08 };
  });
  const N = STOPS.length;
  const SEG = 1;                                   // one stop per unit of timeline
  const stopAt = (name) => Math.max(0, STOPS.findIndex((st) => st.name === name)) * SEG;

  /** Layout box of an element in the sample product's own coordinates. */
  const boxOf = (el, root = world) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  /** The part of the screen the camera frames into: beside the captions (desktop) or above them (phones). */
  const frame = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (section.classList.contains('is-static')) return { x: 16, y: 16, w: w - 32, h: h - 32 };
    if (w < 900) return { x: 12, y: 12, w: w - 24, h: h * 0.4 - 12 };
    const left = Math.max(w * 0.37, 470);
    return { x: left, y: 20, w: w - left - 40, h: h - 48 };
  };

  /** Camera settings that frame stop i: centre point and log of the scale. */
  const view = (i) => {
    const s = STOPS[i];
    const W = WORLD();
    const f = frame();
    if (s.name === 'intro') {                      // the top of the product, as wide as the frame allows
      const k = f.w / W.w;
      return { cx: W.w / 2, cy: Math.min(W.h, f.h / k) / 2, z: Math.log(k) };
    }
    const r = s.sel ? boxOf($(s.sel, world)) : { x: 0, y: 0, ...W };
    const scale = Math.min(f.w / (r.w * s.pad), f.h / (r.h * s.pad), 2.4);
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, z: Math.log(scale) };
  };

  const cam = { cx: 0, cy: 0, z: 0 };
  const render = () => {
    const f = frame();
    const s = Math.exp(cam.z);
    world.style.transform = `translate(${f.x + f.w / 2 - cam.cx * s}px, ${f.y + f.h / 2 - cam.cy * s}px) scale(${s})`;
  };

  // Reduced motion: a still picture of the whole product and every caption, no pinning.
  if (reduced) {
    section.classList.add('is-static');
    Object.assign(cam, view(N - 1));
    render();
    if (live) gsap.set(live, { opacity: 1 });
    $$('[data-fill]', world).forEach((f) => { f.textContent = f.dataset.fill; });
    $$('[data-count]', world).forEach((el) => { el.textContent = fmt(el, +el.dataset.count); });
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

  Object.assign(cam, view(0));
  tl.set(cam, { cx: () => view(0).cx, cy: () => view(0).cy, z: () => view(0).z }, 0);

  // Camera moves between stops, and captions swap as the camera arrives.
  for (let i = 1; i < N; i++) {
    const at = i * SEG;
    tl.to(cam, { cx: () => view(i).cx, cy: () => view(i).cy, z: () => view(i).z, duration: 0.42 * SEG, ease: 'power2.inOut' }, at - 0.3 * SEG)
      .to(caps[i - 1], { autoAlpha: 0, y: -24, duration: 0.12 * SEG, ease: 'power2.in' }, at - 0.18 * SEG)
      .fromTo(caps[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.16 * SEG, ease: 'power3.out' }, at);
  }

  /* ------------------------------------------------------------ demos */
  const stopOf = (el) => el.dataset.at || el.closest('[data-stop]')?.dataset.stop || 'site';
  const IR = { immediateRender: false };
  const perStop = {};                               // several "type" fields in one stop go one after another
  $$('[data-anim]', world).forEach((el) => {
    const name = stopOf(el);
    const at = stopAt(name) + (parseFloat(el.dataset.delay) || 0.06);
    const kind = el.dataset.anim;
    if (kind === 'rise') {
      tl.fromTo(el.children, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, stagger: 0.06, ease: 'power3.out', ...IR }, at);
    } else if (kind === 'grow') {
      tl.fromTo(el.children, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.3, stagger: 0.03, ease: 'power3.out', ...IR }, at);
    } else if (kind === 'pop') {
      tl.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.14, ease: 'back.out(2.2)' }, at);   // hidden until its moment
    } else if (kind === 'type') {
      const k = (perStop[name] = (perStop[name] ?? -1) + 1);
      const text = el.dataset.fill, typed = { n: 0 };
      el.textContent = '';
      tl.to(typed, { n: text.length, duration: 0.1, onUpdate: () => { el.textContent = text.slice(0, Math.round(typed.n)); } }, at + k * 0.08);
    } else if (kind === 'count') {
      // shows the real number at rest; counts up from zero while its stop plays
      const end = +el.dataset.count, v = { n: 0 };
      el.textContent = fmt(el, end);
      const tw = gsap.to(v, { n: end, duration: 0.4, ease: 'power2.out', paused: true,
        onUpdate: () => { el.textContent = fmt(el, tw.progress() === 0 ? end : v.n); } });
      tl.add(tw.play(), at);
    } else if (kind === 'check') {
      // each item ticks as the playhead passes it (and unticks when scrubbing back)
      Array.from(el.children).forEach((li, k) => {
        const p = { v: 0 };
        tl.to(p, { v: 1, duration: 0.05, onUpdate: () => li.classList.toggle('done', p.v > 0.5) }, at + k * 0.08);
      });
    } else if (kind === 'press') {
      tl.fromTo(el, { scale: 1 }, { keyframes: { scale: [1, 0.93, 1] }, duration: 0.1, ...IR }, at);
    } else if (kind === 'load') {
      const img = el.querySelector('img'), bar = el.querySelector('.tw-load');
      if (bar) tl.fromTo(bar.firstElementChild, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power1.inOut', ...IR }, at)
        .fromTo(bar, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.08, ...IR }, at + 0.36);
      if (img) tl.fromTo(img, { opacity: 0.25, scale: 1.08, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power2.out', ...IR }, at + 0.12);
    } else if (kind === 'focus') {
      const ring = el.querySelector('.tw-focus');
      const items = $$('[data-focus]', el);
      if (!ring || !items.length) return;
      const place = (it) => { const b = boxOf(it, el); return { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4 }; };
      tl.set(ring, { ...place(items[0]), opacity: 0 }, at - 0.01)
        .to(ring, { opacity: 1, duration: 0.04 }, at);
      items.forEach((it, k) => tl.to(ring, { ...place(it), duration: 0.06, ease: 'power2.inOut' }, at + 0.04 + k * 0.08));
      tl.to(ring, { opacity: 0, duration: 0.05 }, stopAt(name) + SEG - 0.22);
    }
  });

  // Overlays (search result, notification, ...) show during their stop.
  $$('.tour-pop[data-at]').forEach((pop) => {
    const s = stopAt(pop.dataset.at), d = parseFloat(pop.dataset.delay) || 0.12;
    tl.fromTo(pop, { autoAlpha: 0, y: -18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14, ease: 'back.out(1.6)', ...IR }, s + d)
      .to(pop, { autoAlpha: 0, y: -12, duration: 0.1 }, s + SEG - 0.24);
  });

  // The whole product: it goes live.
  if (live) tl.fromTo(live, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'back.out(2.5)', ...IR }, stopAt('site') + 0.2);
  tl.to({}, { duration: 0.5 }, (N - 1) * SEG + 0.3);     // hold on the finished product

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

/** Number text for data-count elements. */
function fmt(el, n) {
  const dec = +(el.dataset.dec || 0);
  const v = dec ? n.toFixed(dec) : Math.round(n).toLocaleString('en-US');
  return (el.dataset.prefix || '') + v + (el.dataset.suffix || '');
}
