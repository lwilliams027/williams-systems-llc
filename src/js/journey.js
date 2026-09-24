/* =====================================================================
   The journey — the whole home page as one scroll-scrubbed "camera move".

   One pinned stage, one master timeline, scrubbed by scroll. Scenes and the
   direction the camera travels into each:

     1. fall    ↓  logo falls through the page onto the headline   (fall.js)
     2. build   →  sideways along a blueprint strip: icons draw, names decode
     3. code    ⊕  zoom into an editor window; the code types itself
     4. rise    ↑  camera climbs past the process steps, which flip up in 3D
     5. end     ⊖  zoom out onto the call to action

   Timing is in "units"; SCREEN units = one screen-height of scroll. Tweak the
   chapter lengths below to make any part play faster or slower.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { buildFall } from './fall.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, ScrambleTextPlugin);

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// The fall timeline is ~10 units long; at 6.25 units per screen it takes 1.6
// screens of scroll (it was 3.2 on its own — twice as fast now).
const SCREEN = 6.25;
const LEN = {             // chapter lengths, in screens of scroll
  toBuild: 0.7,           // fall scene slides away left, strip slides in
  strip:   2.2,           // sideways travel along the strip
  zoom:    0.8,           // fly into the editor card
  type:    1.1,           // code types itself
  toRise:  0.7,           // camera tilts up into the next scene
  climb:   1.8,           // climb past the steps
  out:     0.7,           // zoom out onto the call to action
  hold:    0.25,
};
const S = (k) => LEN[k] * SCREEN;

/* ---------------------------------------------------------------- */
/*  Code for the editor scene — VS Code Dark+ token classes          */
/* ---------------------------------------------------------------- */
const CODE = [
  [['c', '// your-product/project.config.js']],
  [['k', 'export'], ['', ' '], ['k', 'const'], ['', ' project = {']],
  [['', '  '], ['p', 'client'], ['', ': '], ['s', "'You'"], ['', ',']],
  [['', '  '], ['p', 'web'], ['', ': ['], ['s', "'React'"], ['', ', '], ['s', "'Next.js'"], ['', '],']],
  [['', '  '], ['p', 'api'], ['', ': ['], ['s', "'Node'"], ['', ', '], ['s', "'Postgres'"], ['', '],']],
  [['', '  '], ['p', 'saas'], ['', ': { '], ['p', 'billing'], ['', ': '], ['s', "'Stripe'"], ['', ' },']],
  [['', '  '], ['p', 'mobile'], ['', ': ['], ['s', "'iOS'"], ['', ', '], ['s', "'Android'"], ['', '],']],
  [['', '  '], ['p', 'cloud'], ['', ': { '], ['p', 'ci'], ['', ': '], ['k', 'true'], ['', ', '], ['p', 'backups'], ['', ': '], ['k', 'true'], ['', ' },']],
  [['', '};']],
  [],
  [['k', 'await'], ['', ' '], ['f', 'ship'], ['', '(project);']],
  [['c', "// live, and it's yours"]],
];

function renderCode() {
  const target = $('#codeTarget');
  if (!target || target.childElementCount) return;
  CODE.forEach((tokens, i) => {
    const line = document.createElement('span');
    line.className = 'code-line';
    const ln = document.createElement('span');
    ln.className = 'ln';
    ln.textContent = String(i + 1);
    line.append(ln);
    tokens.forEach(([cls, text]) => {
      const tok = document.createElement('span');
      if (cls) tok.className = `t-${cls}`;
      for (const ch of text) {
        const c = document.createElement('span');
        c.className = 'code-ch';
        c.textContent = ch;
        tok.append(c);
      }
      line.append(tok);
    });
    target.append(line);
  });
}

function buildStars() {
  const box = $('#riseStars');
  if (!box || box.childElementCount) return;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 110; i++) {
    const s = document.createElement('i');
    s.className = 'rise-star';
    s.style.left = `${rand() * 100}%`;
    s.style.top = `${rand() * 100}%`;
    s.style.setProperty('--a', (0.15 + rand() * 0.55).toFixed(2));
    if (rand() < 0.15) { s.style.width = s.style.height = '3px'; }
    box.append(s);
  }
}

export function initJourney({ reduced = false } = {}) {
  const section = $('#journey');
  if (!section) return;
  renderCode();
  buildStars();

  if (reduced) {
    section.classList.add('journey-static');
    buildFall({ reduced: true });
    return;
  }

  const fallScene = $('#fall');
  const build = $('#sceneBuild');
  const track = $('#buildTrack');
  const card  = $('#editorCard');
  const code  = $('#sceneCode');
  const rise  = $('#sceneRise');
  const riseTrack = $('#riseTrack');
  const end   = $('#sceneEnd');

  const master = gsap.timeline({ defaults: { ease: 'none' } });

  /* ---- 1 · fall ---------------------------------------------------- */
  const fall = buildFall();
  if (fall) master.add(fall, 0);
  master.addLabel('fallEnd');

  /* ---- 2 · sideways onto the build strip --------------------------- */
  gsap.set(build, { xPercent: 100, autoAlpha: 1 });
  master
    .to(fallScene, { xPercent: -100, duration: S('toBuild'), ease: 'power2.inOut' }, 'fallEnd')
    .to(build, { xPercent: 0, duration: S('toBuild'), ease: 'power2.inOut' }, 'fallEnd')
    .addLabel('strip');

  const travel = () => card.offsetLeft + card.offsetWidth / 2 - window.innerWidth / 2;
  master
    .to(track, { x: () => -travel(), duration: S('strip') }, 'strip')
    .fromTo('.build-grid', { backgroundPosition: '0px 0px' },
      { backgroundPosition: () => `${-travel() * 0.35}px 0px`, duration: S('strip') }, 'strip');

  // Each panel animates as it crosses into view: the icon draws, the name
  // decodes from scrambled characters, the details fade up.
  const vw = window.innerWidth;
  $$('.build-panel', track).forEach((panel) => {
    const f = gsap.utils.clamp(0, 0.92, (panel.offsetLeft - vw * 0.8) / travel());
    const at = master.labels.strip + f * S('strip');
    const name = $('.build-name', panel);
    name.setAttribute('aria-label', name.dataset.text);
    name.textContent = '';
    master
      .fromTo($$('.build-icon path, .build-icon rect', panel), { drawSVG: '0%' },
        { drawSVG: '100%', duration: 0.5 * SCREEN, stagger: 0.03 * SCREEN, ease: 'power1.inOut' }, at)
      .to(name, { scrambleText: { text: name.dataset.text, chars: 'upperCase', speed: 0.5, revealDelay: 0.3 },
        duration: 0.45 * SCREEN }, at + 0.1 * SCREEN)
      .fromTo($$('p, .chips, .build-num', panel), { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.3 * SCREEN, stagger: 0.05 * SCREEN, ease: 'power2.out' }, at + 0.15 * SCREEN);
  });

  /* ---- 3 · zoom into the editor, then it types ---------------------- */
  master.addLabel('zoom');
  const fill = () => Math.max(window.innerWidth / card.offsetWidth, window.innerHeight / card.offsetHeight) * 1.15;
  const others = [...track.children].filter((el) => el !== card);
  master
    .to(card, { scale: fill, duration: S('zoom'), ease: 'power2.in', transformOrigin: '50% 50%' }, 'zoom')
    .to(others, { autoAlpha: 0, duration: S('zoom') * 0.4 }, 'zoom')
    .to('.build-grid', { autoAlpha: 0, duration: S('zoom') * 0.5 }, 'zoom')
    .fromTo(code, { autoAlpha: 0 }, { autoAlpha: 1, duration: S('zoom') * 0.3 }, `zoom+=${S('zoom') * 0.7}`)
    .fromTo('#editor', { scale: 1.3 }, { scale: 1, duration: S('zoom') * 0.5, ease: 'power2.out' }, `zoom+=${S('zoom') * 0.7}`)
    .addLabel('type')
    // The strip (with its giant zoomed card) is fully covered now; hide it so it
    // can't show through later transitions. A timeline set, so it undoes on reverse.
    .set(build, { autoAlpha: 0 }, 'type')
    .set(fallScene, { autoAlpha: 0 }, 'type');

  const chars = $$('.code-ch', code);
  const caret = document.createElement('span');
  caret.className = 'caret';
  const firstLine = $('.code-line', code);
  firstLine.append(caret);
  const typer = { n: 0 };
  let shown = 0;
  const renderTyping = () => {
    const n = Math.round(typer.n);
    if (n === shown) return;
    if (n > shown) for (let i = shown; i < n; i++) chars[i].classList.add('on');
    else for (let i = n; i < shown; i++) chars[i].classList.remove('on');
    shown = n;
    if (n === 0) firstLine.append(caret);
    else chars[n - 1].after(caret);
  };
  master
    .fromTo(typer, { n: 0 }, { n: chars.length, duration: S('type'), onUpdate: renderTyping }, 'type')
    .fromTo('.term-line', { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.2 * SCREEN, stagger: 0.25 * SCREEN }, `type+=${S('type') * 0.85}`);

  /* ---- 4 · camera moves up into the climb --------------------------- */
  master.addLabel('up', `+=${0.2 * SCREEN}`);
  gsap.set(rise, { yPercent: -100, autoAlpha: 1 });
  const climb = () => Math.max(0, riseTrack.offsetHeight - window.innerHeight);
  master
    .to(code, { yPercent: 100, duration: S('toRise'), ease: 'power2.inOut' }, 'up')
    .to(rise, { yPercent: 0, duration: S('toRise'), ease: 'power2.inOut' }, 'up')
    .fromTo('#riseStars', { y: 0 }, { y: () => window.innerHeight * 0.9, duration: S('toRise') + S('climb') }, 'up')
    .fromTo('.rise-head', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.4 * SCREEN, ease: 'power2.out' }, `up+=${S('toRise') * 0.5}`)
    // Pinned to the end of the tilt, not appended: the stars' drift above spans
    // both chapters, and appending would park the climb after it.
    .addLabel('climb', `up+=${S('toRise')}`)
    .fromTo(riseTrack, { y: () => -climb() }, { y: 0, duration: S('climb') }, 'climb')
    .fromTo('#riseFill', { scaleY: 0 }, { scaleY: 1, duration: S('climb') }, 'climb');

  // Steps flip down into place as they come in over the top edge.
  const vh = window.innerHeight;
  $$('.rise-step', riseTrack).forEach((step) => {
    const f = 1 - (step.offsetTop + step.offsetHeight - vh * 0.1) / climb();
    const at = f <= 0
      ? master.labels.up + S('toRise') * 0.55
      : master.labels.climb + Math.min(f, 0.9) * S('climb');
    master.fromTo(step, { rotationX: 80, autoAlpha: 0, transformOrigin: '50% 0%' },
      { rotationX: 0, autoAlpha: 1, duration: 0.45 * SCREEN, ease: 'power3.out' }, at);
  });

  /* ---- 5 · zoom out onto the call to action -------------------------- */
  master.addLabel('out', `climb+=${S('climb')}`);
  master
    .to(rise, { scale: 0.55, borderRadius: 32, autoAlpha: 0, duration: S('out'), ease: 'power2.inOut' }, 'out')
    .fromTo(end, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: S('out') * 0.8, ease: 'power2.out' }, `out+=${S('out') * 0.2}`)
    .fromTo(['.end-mark', '.end-title', '.end-sub', '#sceneEnd .btn'], { autoAlpha: 0, y: 30 },
      { autoAlpha: 1, y: 0, duration: 0.35 * SCREEN, stagger: 0.1 * SCREEN, ease: 'power3.out' }, `out+=${S('out') * 0.45}`)
    .to({}, { duration: S('hold') });

  if (import.meta.env.DEV) window.__journey = master;   // for tuning in the console

  const st = ScrollTrigger.create({
    animation: master,
    trigger: section,
    start: 'top top',
    end: () => '+=' + (master.duration() / SCREEN) * window.innerHeight,
    pin: true,
    scrub: 0.7,
    anticipatePin: 1,
    invalidateOnRefresh: true,
  });

  // Clicking "Scroll to get started" plays the fall for you.
  $('#scrollCue')?.addEventListener('click', () => {
    const y = st.start + (master.labels.fallEnd / master.duration()) * (st.end - st.start);
    gsap.to(window, { scrollTo: y, duration: 2.2, ease: 'power1.inOut' });
  });
}
