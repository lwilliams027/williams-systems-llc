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

const FLIP = {
  y: [{ rotateY: -90 }, { rotateY: 90 }], '-y': [{ rotateY: 90 }, { rotateY: -90 }],
  x: [{ rotateX: -90 }, { rotateX: 90 }], '-x': [{ rotateX: 90 }, { rotateX: -90 }],
  zoom: [{ scale: 0.7 }, { scale: 1.35 }],
};
const REST = { x: 0, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 };
const COPY_REST = { x: 0, y: 0, rotateX: 0, rotateZ: 0, skewX: 0, scale: 1 };
const VIS_REST = { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, scaleY: 1 };

/* Every page has its own motion language (<section data-style="…">): how one
   chapter hands over to the next, how the words come in, and how the picture
   arrives. "flip" is the home page's, and reads data-flip on each scene. */
const STYLES = {
  flip: { flip: true, copy: { y: 40 } },
  // Web apps: the chapters are faces of a turning cube; pieces swing in in 3D
  cube: {
    origin: () => `50% 50% ${Math.round(-0.45 * window.innerWidth)}px`, from: { rotateY: 90 }, out: { rotateY: -90 }, dur: 0.45, ease: 'power2.inOut', outAt: 0, outDur: 0.45, outEase: 'power2.inOut', keepOut: true,
    copy: { x: -60 }, visual: { rotateY: -40, rotateX: 14, z: -400 }, visDur: 0.5,
  },
  // SaaS: a deck of cards dealt from the right; the old card sinks back
  deck: {
    from: { x: '105%', rotateZ: 7 }, out: { scale: 0.82, y: -30 }, ease: 'power4.out', dur: 0.45,
    copy: { y: 24, rotateX: -60 }, visual: { x: 160, rotateZ: 9 }, visEase: 'back.out(1.3)',
  },
  // Cloud: chapters float up through haze
  cloud: {
    from: { y: '70%', scale: 0.92, filter: 'blur(18px)' }, out: { y: '-55%', filter: 'blur(18px)' }, rest: { filter: 'blur(0px)' }, ease: 'sine.out', dur: 0.5, outDur: 0.4,
    copy: { y: 30, filter: 'blur(10px)' }, copyOut: { y: -20, filter: 'blur(10px)' },
    visual: { y: 90, filter: 'blur(12px)' }, visRest: { filter: 'blur(0px)' }, visEase: 'sine.out', visDur: 0.55,
  },
  // Personalized AI: a scan line sweeps each chapter in; pictures resolve in digital steps
  scan: {
    from: { clipPath: 'inset(0% 0% 100% 0%)' }, out: { clipPath: 'inset(100% 0% 0% 0%)' }, rest: { clipPath: 'inset(0% 0% 0% 0%)' },
    ease: 'power2.inOut', dur: 0.45, outAt: 0, outDur: 0.45, outEase: 'power2.inOut', keepOut: true,
    copy: { x: -30, skewX: -18 }, copyOut: { x: 30, skewX: 18 },
    visual: { clipPath: 'inset(0% 100% 0% 0%)' }, visRest: { clipPath: 'inset(0% 0% 0% 0%)' }, visEase: 'steps(9)', visDur: 0.45,
  },
  // Launch a new product: chapters blast off upward; pictures sprout up and bounce
  launch: {
    from: { y: '100%', scale: 0.8 }, out: { y: '-100%', scale: 1.1 }, ease: 'back.out(1.3)', dur: 0.45, outEase: 'power3.in',
    copy: { y: 60, scale: 0.9 }, copyEase: 'back.out(1.8)',
    visual: { scale: 0, transformOrigin: '50% 100%' }, visEase: 'elastic.out(1, 0.55)', visDur: 0.6,
  },
  // Modernize an app: a before/after wipe; old chapters fade to grey, pictures sharpen into colour
  wipe: {
    from: { clipPath: 'inset(0% 0% 0% 100%)' }, out: { x: '-8%', filter: 'grayscale(1) brightness(0.5)' }, rest: { clipPath: 'inset(0% 0% 0% 0%)', filter: 'grayscale(0) brightness(1)' },
    ease: 'power3.inOut', dur: 0.45, outAt: 0, outDur: 0.45, keepOut: true,
    copy: { x: 50 }, copyOut: { x: -50 },
    visual: { filter: 'grayscale(1) blur(6px)', scale: 0.94 }, visRest: { filter: 'grayscale(0) blur(0px)' }, visDur: 0.55,
  },
  // Replace spreadsheets: sheets fold down from the top like a pad of paper
  fold: {
    origin: '50% 0%', from: { rotateX: -100 }, out: { y: '-25%', rotateX: 30 }, ease: 'power3.out', dur: 0.45,
    copy: { y: -24 }, copyOut: { y: 24 },
    visual: { scaleY: 0, transformOrigin: '50% 0%' }, visEase: 'power2.out',
  },
  // Secure your software: an iris opens on each chapter; pictures lock in with a jolt
  iris: {
    from: { clipPath: 'circle(0% at 50% 50%)' }, out: { scale: 0.92 }, rest: { clipPath: 'circle(100% at 50% 50%)' }, ease: 'power2.inOut', dur: 0.5,
    copy: { scale: 1.15 },
    visual: { scale: 1.25 }, visEase: 'power4.in', visDur: 0.3,
    after: (A, el, at) => A.to(el, { keyframes: { x: [0, -10, 9, -6, 4, 0] }, duration: 0.2, ease: 'none' }, at),
  },
  // Move to the cloud: chapters are carried across, the old one moving out as the new moves in
  migrate: {
    from: { x: '100%' }, out: { x: '-100%' }, ease: 'power2.inOut', dur: 0.5, outAt: 0, outDur: 0.5, outEase: 'power2.inOut', keepOut: true,
    copy: { x: 80 }, copyOut: { x: -80 },
    visual: { x: 240, rotateZ: -4 }, visEase: 'power3.out', visDur: 0.5,
  },
  // Ongoing support: chapters swing open like a door; pictures hang and settle
  swing: {
    origin: '0% 50%', from: { rotateY: -100 }, out: { rotateY: 80, x: '10%' }, ease: 'power3.out', dur: 0.5,
    copy: { rotateX: -90, transformOrigin: '50% 0%' },
    visual: { rotateZ: -14, transformOrigin: '50% -20%' }, visEase: 'elastic.out(1, 0.45)', visDur: 0.7,
  },
  // Client stories: chapters are photos tossed onto a table
  toss: {
    from: { y: '-110%', rotateZ: -12, scale: 1.08 }, out: { x: '70%', rotateZ: 16 }, ease: 'bounce.out', dur: 0.55,
    copy: { y: 20, rotateZ: -3 },
    visual: { rotateZ: 12, scale: 0.8 }, visEase: 'back.out(1.6)',
  },
  // FAQ: a focus pull, each chapter racking from blur to sharp
  focus: {
    from: { scale: 1.25, filter: 'blur(28px)' }, out: { scale: 0.8, filter: 'blur(24px)' }, rest: { filter: 'blur(0px)' }, ease: 'power2.out', dur: 0.45,
    copy: { filter: 'blur(12px)' }, copyOut: { filter: 'blur(12px)' },
    visual: { scale: 0.85, filter: 'blur(14px)' }, visRest: { filter: 'blur(0px)' },
  },
  // Contact: chapters drop in like letters through a slot
  letter: {
    origin: '50% 0%', from: { y: '-100%', rotateX: 35 }, out: { y: '45%', scale: 0.9 }, ease: 'power3.out', dur: 0.45,
    copy: { y: -30 },
    visual: { y: -80 }, visEase: 'bounce.out', visDur: 0.55,
  },
};

/* Hand-overs shared by every page, like the home page's: each page mixes these
   with its own signature move, so no two chapters in a row change the same way. */
const MOVES = {
  // the camera dives into the picture and comes out in the next chapter
  dive: {
    origin: '72% 55%', from: { scale: 0.45 }, out: { scale: 3.4 }, ease: 'power3.out', dur: 0.45, outDur: 0.4, outEase: 'power2.in',
    copy: { x: -40 }, visual: { scale: 0.6, rotateY: -25 }, visEase: 'power3.out',
  },
  // an elevator ride: the old chapter goes up as the next one comes up from below
  elevator: {
    from: { y: '100%' }, out: { y: '-100%' }, ease: 'power3.inOut', dur: 0.5, outAt: 0, outDur: 0.5, outEase: 'power3.inOut', keepOut: true,
    copy: { y: 50 }, copyOut: { y: -50 }, visual: { y: 140 }, visDur: 0.5,
  },
  // the home page's page flips
  flipY: { from: { rotateY: -90 }, out: { rotateY: 90 }, copy: { y: 40 }, visual: { rotateY: 70 }, visEase: 'back.out(1.4)' },
  flipX: { from: { rotateX: -90 }, out: { rotateX: 90 }, copy: { y: 40 }, visual: { rotateX: -70 }, visEase: 'back.out(1.4)' },
  // the chapter tumbles away and the next spins in
  tumble: {
    from: { rotateZ: -120, scale: 0.3 }, out: { rotateZ: 120, scale: 0.3 }, ease: 'back.out(1.2)', dur: 0.5,
    copy: { rotateZ: -6, y: 30 }, visual: { rotateZ: 25, scale: 0.5 }, visEase: 'back.out(1.7)',
  },
  // shutters open from the middle
  shutter: {
    from: { clipPath: 'inset(50% 0% 50% 0%)' }, out: { clipPath: 'inset(0% 50% 0% 50%)' }, rest: { clipPath: 'inset(0% 0% 0% 0%)' }, ease: 'power3.inOut', dur: 0.45, outAt: 0, outDur: 0.45, keepOut: true,
    copy: { x: -40 }, visual: { clipPath: 'inset(50% 0% 50% 0%)' }, visRest: { clipPath: 'inset(0% 0% 0% 0%)' }, visDur: 0.5,
  },
};
const TRANS = { ...STYLES, ...MOVES };
Object.entries(FLIP).forEach(([k, [from, out]]) => { TRANS[`flip:${k}`] = { from, out, copy: { y: 40 } }; });
delete TRANS.flip;

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
  // Each chapter's own hand-over: data-seq on the section (a list, one per change of
  // chapter), else data-flip on the scene (the home-page flips), else the page's style.
  const S = TRANS[section.dataset.style] || TRANS['flip:y'];
  const seq = (section.dataset.seq || '').split(/[\s,]+/).filter((k) => TRANS[k]);
  const moveOf = (scene, i) => (i === 0 ? S
    : seq.length ? TRANS[seq[(i - 1) % seq.length]]
    : scene.dataset.flip ? TRANS[`flip:${scene.dataset.flip}`] || S : S);
  const moves = scenes.map(moveOf);
  const originOf = (m) => m.origin || '50% 50%';
  gsap.set(scenes, { autoAlpha: 0, transformPerspective: 1600, transformOrigin: originOf(S), ...S.rest });
  gsap.set(scenes[0], { autoAlpha: 1 });
  scenes.forEach((scene, i) => gsap.set($$('.sj-copy > *', scene), { autoAlpha: 0, ...moves[i].copy }));

  if (steps[0]) steps[0].classList.add('on');       // the first chapter is showing from the start
  const SCENE = 1.8;                               // timeline units per chapter
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'none' } }).timeScale(0.75);   // chapter 1 plays by itself
  // ...as soon as the section is on screen (immediately, when it's at the top of the page)
  ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => gsap.delayedCall(0.3, () => intro.play()) });
  // the lit pill follows where the timeline is, in either scroll direction
  tl.eventCallback('onUpdate', () => {
    const i = Math.min(steps.length - 1, Math.floor(tl.time() / SCENE + 0.001));
    steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
  });

  scenes.forEach((scene, i) => {
    const T = i * SCENE;
    const M = moves[i];
    if (i > 0) {
      const prev = scenes[i - 1];
      const outAt = M.outAt ?? -0.35;
      tl.to($$('.sj-copy > *', prev), { autoAlpha: 0, duration: 0.2, stagger: 0.03, ease: 'power2.in', ...(M.copyOut || { y: -30 }) }, T - 0.45)
        // the old chapter leaves the way the new one arrives (starting from that move's own resting pose)
        .fromTo(prev, { ...REST, ...M.rest, transformOrigin: originOf(M) }, { ...M.out, autoAlpha: M.keepOut ? 1 : 0, duration: M.outDur || 0.35, ease: M.outEase || 'power2.in', immediateRender: false }, T + outAt)
        // visible only from its own moment (a set reverts when scrolling back); the entry pose is prepared in advance
        .set(scene, { autoAlpha: 1 }, T)
        .fromTo(scene, { ...REST, ...M.rest, ...M.from, transformOrigin: originOf(M) }, { ...REST, ...M.rest, duration: M.dur || 0.4, ease: M.ease || 'power3.out' }, T);
      if (M.keepOut) tl.set(prev, { autoAlpha: 0 }, T + outAt + (M.outDur || 0.35));
    }
    // The first chapter plays by itself when the page loads; the rest are scrubbed by scroll.
    const A = i === 0 ? intro : tl;
    const B = i === 0 ? 0 : T;
    const copyRest = { ...COPY_REST, ...(M.copy?.filter ? { filter: 'blur(0px)' } : {}) };
    A.to($$('.sj-copy > *', scene), { ...copyRest, autoAlpha: 1, duration: 0.3, stagger: 0.07, ease: M.copyEase || 'power3.out' }, B + 0.12);
    // the chapter's picture arrives to match its move (unless it animates itself)
    const vis = scene.querySelector('.sj-visual:not([data-sj])');
    if (vis && M.visual) {
      A.fromTo(vis, { autoAlpha: 0, ...M.visual }, { ...VIS_REST, ...M.visRest, autoAlpha: 1, duration: M.visDur || 0.4, ease: M.visEase || 'power3.out' }, B + 0.15);
      if (M.after) M.after(A, vis, B + 0.15 + (M.visDur || 0.4));
    }

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
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window[`__flip${idx || ''}`] = tl;
});
