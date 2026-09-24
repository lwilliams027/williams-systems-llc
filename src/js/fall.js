/* =====================================================================
   The fall — a scroll-scrubbed scene on the home page.

   The first screen is blank apart from a "Scroll to get started" cue. As the
   visitor scrolls, the section pins and the scroll plays the scene like
   scrubbing a video: the logo mark falls in from above in four tumbling
   pieces, the page streams past it (three parallax depths of streaks and
   words, so the eye follows the mark downward), then it slows, snaps
   together, the L fills VS Code blue, a ring pulses out, and the headline
   lands underneath. Scrolling back up plays it in reverse.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const BLUE = '#007ACC';
const SCROLL_SCREENS = 3.2;   // how many screen-heights of scroll the fall lasts

// Depth layers: how far each travels (in screen heights) over the fall.
const LAYERS = [
  { cls: 'fall-far',  travel: 1.4, lines: 34, words: 10, big: 0 },
  { cls: 'fall-mid',  travel: 2.6, lines: 26, words: 9,  big: 0 },
  { cls: 'fall-near', travel: 4.2, lines: 12, words: 0,  big: 4 },
];
const WORDS = ['Front end', 'Back end', 'APIs', 'SaaS', 'Mobile', 'Cloud', 'AI & data', 'DevOps',
  'React', 'Node', 'Python', 'Postgres', 'Stripe', 'CI/CD', '</>', '{ }', '01', 'deploy', 'build', 'ship'];
const BIG = ['SaaS', 'Cloud', 'Mobile', 'Web', 'AI'];

/** Small seeded RNG so the scenery is identical on every load. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScenery(stage) {
  const rand = rng(20260924);
  const r = (a, b) => a + rand() * (b - a);
  // Keep words out of the centre column, where the mark falls.
  const sideX = () => (rand() < 0.5 ? r(3, 30) : r(70, 95));

  return LAYERS.map((L, depth) => {
    const layer = document.createElement('div');
    layer.className = `fall-layer ${L.cls}`;
    layer.setAttribute('aria-hidden', 'true');
    layer.style.height = `${(1 + L.travel) * 100}%`;

    for (let i = 0; i < L.lines; i++) {
      const s = document.createElement('i');
      s.className = 'fall-line' + (rand() < 0.22 ? ' blue' : '');
      s.style.left = `${r(1, 99)}%`;
      s.style.top = `${r(0, 100)}%`;
      s.style.height = `${Math.round(r(30, 120) * (1 + depth * 0.9))}px`;
      s.style.setProperty('--a', r(0.18, 0.55).toFixed(2));
      if (depth === 2) s.style.width = '2px';
      layer.append(s);
    }
    for (let i = 0; i < L.words; i++) {
      const w = document.createElement('span');
      w.className = 'fall-word';
      w.textContent = WORDS[Math.floor(rand() * WORDS.length)];
      w.style.left = `${sideX()}%`;
      w.style.top = `${r(4, 96)}%`;
      layer.append(w);
    }
    for (let i = 0; i < L.big; i++) {
      const b = document.createElement('span');
      b.className = 'fall-big';
      b.textContent = BIG[i % BIG.length];
      b.style.left = `${r(-5, 60)}%`;
      b.style.top = `${10 + i * (80 / L.big) + r(-4, 4)}%`;
      layer.append(b);
    }
    // Far, then mid, then near, all behind the falling mark.
    stage.insertBefore(layer, stage.querySelector('#faller'));
    return { el: layer, travel: L.travel };
  });
}

/** Hard-stop vertical gradient on the given paths; moving the stop fills them top to bottom. */
function gradientFill(svg, paths, id) {
  const NS = 'http://www.w3.org/2000/svg';
  const [, y, , h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'linearGradient');
  grad.id = id;
  Object.entries({ gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: y, y2: y + h })
    .forEach(([k, v]) => grad.setAttribute(k, v));
  const stops = [BLUE, BLUE, '#FFFFFF', '#FFFFFF'].map((c) => {
    const s = document.createElementNS(NS, 'stop');
    s.setAttribute('stop-color', c);
    grad.append(s);
    return s;
  });
  defs.append(grad);
  svg.prepend(defs);
  paths.forEach((p) => p.setAttribute('fill', `url(#${id})`));
  const state = { p: 0 };
  const render = () => {
    stops[0].setAttribute('offset', '0');
    stops[1].setAttribute('offset', String(state.p));
    stops[2].setAttribute('offset', String(state.p));
    stops[3].setAttribute('offset', '1');
  };
  render();
  return { state, render };
}

/** The "Scroll to get started" cue: label fades in, arrow drops from above the screen. */
export function dropCue() {
  const cue = $('#scrollCue');
  const tl = gsap.timeline();
  if (!cue) return tl;
  const arrow = $('.scroll-cue-arrow', cue);
  const label = $('.scroll-cue-label', cue);
  const rect = arrow.getBoundingClientRect();
  gsap.set(cue, { autoAlpha: 1 });
  gsap.set(arrow, { opacity: 0, y: -(rect.top + rect.height + 20) });
  gsap.set(label, { opacity: 0 });

  tl.to(label, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0)
    .to(arrow, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0.1)
    .to(arrow, { y: 0, duration: 0.85, ease: 'power2.in' }, 0.1)     // accelerating fall
    .to(arrow, { y: -14, duration: 0.16, ease: 'sine.out' })          // bounce up
    .to(arrow, { y: 0, duration: 0.5, ease: 'bounce.out' })           // settle
    .add(() => cue.classList.add('looping'));
  return tl;
}

export function initFall({ reduced = false } = {}) {
  const section = $('#fall');
  if (!section) return;
  const stage  = $('.fall-stage', section);
  const faller = $('#faller');
  const rotor  = $('.faller-rotor', faller);
  const trail  = $('.faller-trail', faller);
  const ring   = $('.faller-ring', faller);
  const svg    = $('.faller-mark', faller);
  const [lb, w1, w2, rb] = $$('path', svg);
  const landing = $('#landing');
  const title  = $('.landing-title', landing);
  const extras = $$('.landing-sub, .landing .btn', landing);
  const cue    = $('#scrollCue');

  const fill = gradientFill(svg, [w1], 'fallFillGrad');
  gsap.set(faller, { xPercent: -50, yPercent: -50 });
  gsap.set(ring, { xPercent: -50, yPercent: -50 });

  // Final resting state (used as-is for reduced motion).
  const landedY = () => -window.innerHeight * 0.17;
  if (reduced) {
    gsap.set(faller, { y: landedY(), scale: 0.5 });
    gsap.set([title, ...extras], { visibility: 'visible' });
    fill.state.p = 1; fill.render();
    if (cue) cue.hidden = true;
    return;
  }

  const layers = buildScenery(stage);
  const split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'line' });
  gsap.set(title, { visibility: 'visible' });

  // Start states: mark above the screen in four scattered pieces (SVG user units).
  gsap.set(faller, { y: () => -window.innerHeight * 0.95, scale: 1 });
  gsap.set(rotor, { rotation: -18 });
  const scatter = [
    [lb, { x: -520, y: -260, rotation: -40 }],
    [w1, { x: -150, y: 380, rotation: 30 }],
    [w2, { x: 190, y: -420, rotation: -25 }],
    [rb, { x: 560, y: 300, rotation: 45 }],
  ];
  scatter.forEach(([p, s]) => gsap.set(p, { ...s, transformOrigin: '50% 50%' }));
  gsap.set(trail, { opacity: 0 });
  gsap.set(ring, { scale: 0.2, opacity: 0 });
  gsap.set(landing, { y: () => window.innerHeight * 0.45 });
  gsap.set(split.lines, { yPercent: 110 });
  gsap.set(extras, { autoAlpha: 0, y: 24 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + window.innerHeight * SCROLL_SCREENS,
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // 0 → 2: the cue clears and the mark drops into frame, accelerating.
  if (cue) tl.to(cue, { autoAlpha: 0, y: 30, duration: 0.4 }, 0);
  tl.to(faller, { y: 0, duration: 2, ease: 'power2.in' }, 0)
    .to(trail, { opacity: 1, duration: 0.8 }, 0.5);

  // 0.4 → 8: the page streams upward past the mark — the "camera" following it down.
  // The scenery is invisible at rest so the first screen stays blank.
  gsap.set(layers.map((l) => l.el), { autoAlpha: 0 });
  tl.to(layers.map((l) => l.el), { autoAlpha: 1, duration: 0.9, stagger: 0.15 }, 0.2);
  layers.forEach(({ el, travel }) => {
    tl.fromTo(el, { y: 0 }, { y: () => -window.innerHeight * travel, duration: 7.6, ease: 'sine.inOut' }, 0.4);
  });

  // Tumble and sway while falling; lands upright (360°).
  tl.to(rotor, { rotation: 360, duration: 7.2, ease: 'power1.inOut' }, 0)
    .to(faller, { keyframes: { x: [0, 46, -38, 20, 0], easeEach: 'sine.inOut' }, duration: 6.6 }, 0.4);

  // The four pieces drift together over the fall and click into place.
  tl.to([lb, w1, w2, rb], { x: 0, y: 0, rotation: 0, duration: 5.4, ease: 'power3.inOut', stagger: 0.12 }, 1.8);

  // 6.4 → 8: the ground (headline) rises into view; the mark slows and settles above it.
  tl.to(landing, { y: 0, duration: 1.6, ease: 'power3.out' }, 6.4)
    .to(faller, { y: landedY, scale: 0.5, duration: 1.4, ease: 'power3.out' }, 6.6)
    .to(trail, { opacity: 0, duration: 0.6 }, 6.8)
    // Scenery dims as it lands so nothing competes with the headline.
    .to(layers.map((l) => l.el), { autoAlpha: 0.25, duration: 1.2 }, 6.8);

  // 7.6 → 9.4: impact — ring pulse, the L fills blue, the words land.
  tl.fromTo(ring, { scale: 0.2, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1, ease: 'power2.out', immediateRender: false }, 7.6)
    .fromTo(fill.state, { p: 0 }, { p: 1, duration: 1, ease: 'power2.inOut', onUpdate: fill.render }, 7.6)
    .to(split.lines, { yPercent: 0, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, 7.9)
    .to(extras, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.15, ease: 'power3.out' }, 8.5)
    .to({}, { duration: 0.8 });   // a beat of stillness at the end

  // Clicking the cue plays the whole fall for you.
  cue?.addEventListener('click', () => {
    gsap.to(window, { scrollTo: tl.scrollTrigger.end, duration: 3.4, ease: 'power1.inOut' });
  });
}
