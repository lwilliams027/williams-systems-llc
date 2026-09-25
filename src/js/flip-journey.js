/* =====================================================================
   Flip journey: the home-page-style story sequence, driven by markup.

   <section class="sj" data-journey>
     <div class="sj-stage">
       <div class="sj-scene" data-scene data-label="Meet" data-flip="y"> … </div>
       …
       <ol class="sj-progress"></ol>          (filled in from the data-labels)
     </div>
   </section>

   Each scene fills the screen. The next one arrives with a 3D flip:
   data-flip = "y" (sideways, default), "x" (up), "-y", "-x", or "zoom".
   Inside a scene, anything with data-sj animates after the scene lands
   (data-d = extra delay, in timeline units):
     type   types out data-text          flap   letters rattle into data-text
     draw   its SVG paths draw           flip   its .sj-tile-in children flip over
     pop    pops in                      stamp  slams down like a rubber stamp
     count  counts to data-count (data-prefix, data-suffix, data-dec)
     check  its <li>s get ticked in turn  rise   its children rise in turn
     grow   its children grow up         fill   it fills left to right
   The section is pinned and the whole thing is scrubbed by scroll.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, DrawSVGPlugin);

const fmt = (el, n) => {
  const dec = +(el.dataset.dec || 0);
  return (el.dataset.prefix || '') + (dec ? n.toFixed(dec) : Math.round(n).toLocaleString('en-US')) + (el.dataset.suffix || '');
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Product pieces are drawn at their real design size and scaled to fit the chapter. */
function fitAll() {
  document.querySelectorAll('.fj-fit').forEach((box) => {
    const f = box.firstElementChild;
    if (!f) return;
    f.style.transform = 'none';
    const w = f.offsetWidth, h = f.offsetHeight;
    const maxW = box.parentElement.clientWidth || box.clientWidth;
    const maxH = window.innerHeight * (window.innerWidth < 900 ? 0.36 : 0.66);
    const k = Math.min(maxW / w, maxH / h, 1);
    f.style.transformOrigin = '0 0';
    f.style.transform = `scale(${k})`;
    box.style.width = `${w * k}px`;
    box.style.height = `${h * k}px`;
  });
}
fitAll();
window.addEventListener('resize', fitAll);
if (document.fonts) document.fonts.ready.then(fitAll);

document.querySelectorAll('[data-journey]').forEach((section, idx) => {
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scenes = $$('[data-scene]');
  const progress = section.querySelector('.sj-progress');
  if (progress && !progress.children.length) progress.innerHTML = scenes.map((s) => `<li>${s.dataset.label || ''}</li>`).join('');
  const steps = $$('.sj-progress li');
  const anims = $$('[data-sj]');

  // Reduced motion: every chapter shown, finished.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-static');
    anims.forEach((el) => {
      if (el.dataset.text && /type|flap/.test(el.dataset.sj)) el.textContent = el.dataset.text;
      if (el.dataset.sj === 'count') el.textContent = fmt(el, +el.dataset.count);
      if (el.dataset.sj === 'check') $$('li', el).forEach((li) => li.classList.add('done'));
    });
    return;
  }

  /* ---------- starting state ---------- */
  gsap.set(scenes, { autoAlpha: 0, transformPerspective: 1600, transformOrigin: '50% 50%' });
  gsap.set(scenes[0], { autoAlpha: 1 });
  gsap.set($$('.sj-copy > *'), { autoAlpha: 0, y: 40 });

  if (steps[0]) steps[0].classList.add('on');       // the first chapter is showing from the start
  const SCENE = 1.8;                               // timeline units per chapter
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'none' } }).timeScale(0.75);   // chapter 1 plays by itself
  // ...as soon as the section is on screen (immediately, when it's at the top of the page)
  ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => gsap.delayedCall(0.3, () => intro.play()) });
  const mark = (i, at) => tl.call(() => steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); }), null, at);
  const FLIP = {
    y: [{ rotateY: -90 }, { rotateY: 90 }], '-y': [{ rotateY: 90 }, { rotateY: -90 }],
    x: [{ rotateX: -90 }, { rotateX: 90 }], '-x': [{ rotateX: 90 }, { rotateX: -90 }],
    zoom: [{ scale: 0.7 }, { scale: 1.35 }],
  };

  scenes.forEach((scene, i) => {
    const T = i * SCENE;
    const [inFrom, outTo] = FLIP[scene.dataset.flip || 'y'] || FLIP.y;
    if (i > 0) {
      const prev = scenes[i - 1];
      tl.to($$('.sj-copy > *', prev), { autoAlpha: 0, y: -30, duration: 0.2, stagger: 0.03, ease: 'power2.in' }, T - 0.45)
        .to(prev, { ...outTo, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, T - 0.35)
        // visible only from its own moment (a set reverts when scrolling back); the flip pose is prepared in advance
        .set(scene, { autoAlpha: 1 }, T)
        .fromTo(scene, { rotateX: 0, rotateY: 0, scale: 1, ...inFrom }, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.4, ease: 'power3.out' }, T);
    }
    mark(i, T + 0.001);
    // The first chapter plays by itself when the page loads; the rest are scrubbed by scroll.
    const A = i === 0 ? intro : tl;
    const B = i === 0 ? 0 : T;
    A.to($$('.sj-copy > *', scene), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power3.out' }, B + 0.12);

    // the animations inside this scene
    $$('[data-sj]', scene).forEach((el) => {
      const at = B + 0.3 + (parseFloat(el.dataset.d) || 0);
      const kind = el.dataset.sj;
      if (kind === 'type') {
        const txt = el.dataset.text, p = { n: 0 };
        el.textContent = '';
        A.to(p, { n: txt.length, duration: Math.min(0.5, 0.05 + txt.length * 0.012), onUpdate: () => { el.textContent = txt.slice(0, Math.round(p.n)); } }, at);
      } else if (kind === 'flap') {
        el.textContent = el.dataset.text.replace(/[A-Z0-9]/g, ' ');
        A.to(el, { scrambleText: { text: el.dataset.text, chars: LETTERS, speed: 0.6, revealDelay: 0.3 }, duration: 0.35 }, at);
        if (el.dataset.color) A.fromTo(el, { color: '#9CA3AF' }, { color: el.dataset.color, duration: 0.05 }, at + 0.33);
      } else if (kind === 'draw') {
        const paths = el.matches('path, line, circle, rect, polyline') ? [el] : $$('path, line, circle, polyline', el).filter((p) => !p.closest('defs'));
        gsap.set(paths, { drawSVG: '0%' });
        A.to(paths, { drawSVG: '100%', duration: parseFloat(el.dataset.dur) || 0.6, stagger: 0.06, ease: 'power1.inOut' }, at);
      } else if (kind === 'flip') {
        const tiles = $$('.sj-tile-in', el);
        gsap.set(tiles, { rotateY: 180 });
        A.to(tiles, { rotateY: 0, duration: 0.35, stagger: 0.09, ease: 'back.out(1.4)' }, at);
      } else if (kind === 'pop') {
        gsap.set(el, { autoAlpha: 0, scale: 0.6 });
        A.to(el, { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, at);
      } else if (kind === 'stamp') {
        gsap.set(el, { autoAlpha: 0, scale: 2.2, rotate: -18 });
        A.to(el, { autoAlpha: 1, scale: 1, rotate: -8, duration: 0.18, ease: 'power4.in' }, at);
      } else if (kind === 'count') {
        const end = +el.dataset.count, v = { n: 0 };
        el.textContent = fmt(el, 0);
        A.to(v, { n: end, duration: 0.5, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(el, v.n); } }, at);
      } else if (kind === 'check') {
        $$('li', el).forEach((li, k) => {
          const p = { v: 0 };
          A.to(p, { v: 1, duration: 0.05, onUpdate: () => li.classList.toggle('done', p.v > 0.5) }, at + k * 0.1);
        });
      } else if (kind === 'rise') {
        gsap.set(el.children, { autoAlpha: 0, y: 30 });
        A.to(el.children, { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.08, ease: 'power3.out' }, at);
      } else if (kind === 'grow') {
        gsap.set(el.children, { scaleY: 0, transformOrigin: '50% 100%' });
        A.to(el.children, { scaleY: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out' }, at);
      } else if (kind === 'press') {
        A.fromTo(el, { scale: 1 }, { keyframes: { scale: [1, 0.92, 1] }, duration: 0.12, immediateRender: false }, at);
      } else if (kind === 'fill') {
        gsap.set(el, { scaleX: 0, transformOrigin: '0% 50%' });
        A.to(el, { scaleX: 1, duration: parseFloat(el.dataset.dur) || 0.5, ease: 'power1.inOut' }, at);
      }
    });
  });
  tl.to({}, { duration: 0.5 }, (scenes.length - 1) * SCENE + 1.4);   // hold on the last chapter

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * (scenes.length * 1.8 + 0.4),
    pin: section.querySelector('.sj-stage'),
    scrub: 0.7,
    animation: tl,
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window[`__flip${idx || ''}`] = tl;
});
