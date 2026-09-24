/* =====================================================================
   The journey — the whole home page as one scroll-scrubbed "camera move".

   One pinned stage, one master timeline, scrubbed by scroll:

     1. fall    ↓  logo falls through the page onto the headline      (fall.js)
     2. build   →  sideways along a blueprint strip: icons draw, names decode
     3. zoom    ⊕  the small editor in the strip grows to full screen (one
                   element — no crossfade) and types a project config
     4. stack   ⟲  Win+Tab / Flip 3D: the editor tilts into a 3D stack with the
                   other deliverables and they cycle to the front one by one,
                   ending on the website — the camera zooms into it and scrolls
                   down the site inside the window
     5. desk    ⤵  the camera swings up and over 180° to look straight down on
                   the website lying on a blueprint desk
     5a. bulb   💡 a lit bulb drops in on its cord, swings to rest and lights the
                   page (light mode). It's unscrewed turn by turn while the site
                   flickers, comes loose with a spark, the lights die (dark mode)
                   and it falls — the camera follows it down to the login page
     5b. secure    a sign-in is refused (screen shakes), a padlock rises, and
                   the camera flies through the keyhole
     6. quotes     client video/photo testimonials on a 3D carousel that turns with the scroll
     6b. rise   ↑  how we work: one full screen per step as the camera keeps rising
     7. finale  ✦  the last step dissolves into a starfield; it warps, the stars
                   swirl into the logo, the headline flies together letter by
                   letter and the services orbit the mark

   Chapter lengths live in LEN (in screens of scroll). Lower = more sensitive.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { SplitText } from 'gsap/SplitText';
import { buildFall } from './fall.js';
import { createFinale } from './finale.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, ScrambleTextPlugin, SplitText);

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = gsap.utils.clamp(0, 1);

// The fall timeline is ~10 units; SCREEN units = one screen of scroll, so the
// fall takes ~1.6 screens.
const SCREEN = 6.25;
const LEN = {             // chapter lengths, in screens of scroll
  toBuild: 0.7,           // fall scene slides away left, strip slides in
  strip:   2.2,           // sideways along the strip
  zoom:    0.8,           // editor grows from the strip to full screen
  type:    1.1,           // code types itself, terminal ships it
  typeHold: 1.4,          // "One team. All custom." takes the screen and holds
  stackIn: 0.5,           // editor tilts back into the Win+Tab stack
  cycle:   3.2,          // windows cycle to the front (a full turn, landing on the website); "Every piece. One build." comes up mid-turn
  focus:   0.7,           // zoom into the website window
  site:    1.5,           // scroll down the website inside it
  desk:    1.1,           // camera swings over 180° to look down on the site
  deskHold: 0.3,
  bulbIn:  1.15,          // a lit bulb drops in, swings to rest, the page lights up
  bulbHold: 0.45,         // pause: read the customization copy
  unscrew: 1.6,           // four turns, the lights flicker, it comes loose (dark mode)
  bulbFall: 1.55,         // it falls; the camera follows it down
  toSecure: 0.7,          // …and the login page rises from below
  denied:  1.1,           // two refused sign-ins; the screen shakes
  lockUp:  0.9,           // a padlock rises and snaps shut
  lockHold: 1.0,          // someone tries it, it holds; the lock sits there with the security copy
  keyhole: 0.9,           // fly through the keyhole
  toRise:  0.7,           // the testimonials give way to how we work
  riseHold: 1.2,          // "From first call to launch." takes the screen before the steps
  climb:   2.0,           // the elevator ride: five floors, one step each
  toQuotes: 0.7,          // out the other side of the keyhole: the testimonials carousel
  quotes:  2.4,           // the carousel turns, one client quote to the front at a time
  toEnd:   0.7,           // the last step dissolves into the starfield
  warp:    0.9,           // the starfield warps
  form:    1.4,           // the stars swirl in and assemble the logo
  reveal:  1.0,           // headline flies together, services orbit, call to action
  hold:    0.5,
};
const S = (k) => LEN[k] * SCREEN;
const SCRUB = 0.7;        // seconds the animation lags the scroll (lower = snappier)

/* ---------------------------------------------------------------- */
/*  Code for the editor — VS Code Dark+ token classes               */
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

function buildBulbStreaks() {
  const box = $('#bulbStreaks');
  if (!box || box.childElementCount) return;
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const l = document.createElement('i');
    l.className = 'fall-line' + (rand() < 0.2 ? ' blue' : '');
    l.style.left = `${rand() * 100}%`;
    l.style.top = `${rand() * 100}%`;
    l.style.height = `${Math.round(50 + rand() * 180)}px`;
    l.style.setProperty('--a', (0.2 + rand() * 0.45).toFixed(2));
    box.append(l);
  }
}

function buildDust() {
  const box = $('#bulbDust');
  if (!box || box.childElementCount) return;
  let seed = 23;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 34; i++) {
    const d = document.createElement('i');
    const depth = rand();                       // further down the cone = wider spread
    d.style.top = `${8 + depth * 70}%`;
    d.style.left = `${50 + (rand() - 0.5) * depth * 70}%`;
    d.style.opacity = (0.3 + rand() * 0.6).toFixed(2);
    d.style.setProperty('--d', `${(6 + rand() * 7).toFixed(1)}s`);
    d.style.setProperty('--dx', `${Math.round((rand() - 0.5) * 40)}px`);
    d.style.setProperty('--dy', `${Math.round(-20 - rand() * 50)}px`);
    if (rand() < 0.25) { d.style.width = d.style.height = '2px'; }
    box.append(d);
  }
}

function buildFloors() {
  const box = $('#riseFloors');
  if (!box || box.childElementCount) return;
  // The box is 600% tall and starts 500% above the scene; line i starts
  // i screens above mid-screen and passes the middle at 1/4 of the ride per floor.
  for (let i = 0; i <= 5; i++) {
    const line = document.createElement('div');
    line.className = 'rise-floor';
    line.style.top = `${((550 - i * 100) / 600) * 100}%`;
    const label = document.createElement('span');
    label.className = 'mono';
    label.textContent = `Floor 0${Math.min(i + 1, 5)}`;
    line.append(label);
    box.append(line);
  }
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

/* ---------------------------------------------------------------- */
/*  The windows: one render() places every window from a handful of   */
/*  progress values, so grow → stack → cycle → focus → scroll →        */
/*  customize → 180° is one continuous move.                           */
/* ---------------------------------------------------------------- */
function createWindowRig({ stage, card, world, floor, wins }) {
  const editor = wins[0];
  const N = wins.length;
  const FOCUS = 1;                                   // the website window gets zoomed into
  const siteBody = $('.site-body', wins[FOCUS]);
  const siteScroll = $('.site-scroll', wins[FOCUS]);
  const edSide = $('.editor-side', editor);
  const edTerm = $('.editor-term', editor);
  const P = { zoom: 0, stack: 0, cycle: 0, focus: 0, site: 0, custom: 0, dark: 0, desk: 0 };

  // Full-size window box, centred in the stage.
  const target = () => {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const g = Math.max(20, Math.min(40, vw * 0.04));
    const w = Math.min(1100, vw - 2 * g);
    const h = Math.min(vh * 0.7, 640, w * 1.1);
    return { x: (vw - w) / 2, y: (vh - h) / 2 + vh * 0.02, w, h, vw, vh };
  };

  // Flip 3D pose for a (fractional) slot: 0 = front, higher = further back.
  // The stack recedes up and to the right (like Windows Flip 3D), shifted so
  // the whole stack, not just the front window, sits centred on screen.
  const stackPose = (s, T) => {
    const sx = T.w * 0.17, sy = T.h * 0.15, mid = (N - 1) / 2;
    return {
      x: (s - mid * 0.55) * sx, y: -(s - mid * 0.55) * sy, z: -s * 420, ry: -34,
      o: s < 0 ? clamp01(1 + 2 * s) : clamp01((N - 0.5 - s) * 2),
    };
  };

  function render() {
    const T = target();
    const sr = stage.getBoundingClientRect();
    const cr = card.getBoundingClientRect();

    // Editor box: from the strip's spacer to full size (layout, not scale, so text stays crisp).
    const z = P.zoom;
    const ex = lerp(cr.left - sr.left, T.x, z), ey = lerp(cr.top - sr.top, T.y, z);
    const ew = lerp(cr.width, T.w, z), eh = lerp(cr.height, T.h, z);
    Object.assign(editor.style, { left: `${ex}px`, top: `${ey}px`, width: `${ew}px`, height: `${eh}px` });
    // The Explorer sidebar and the terminal grow in with the window (no pop-in).
    const grow = clamp01((ew - 520) / 420);
    edSide.style.width = `${210 * grow}px`;
    edSide.style.opacity = String(grow);
    edTerm.style.maxHeight = `${90 * grow}px`;
    edTerm.style.opacity = String(grow);
    for (let i = 1; i < N; i++) {
      Object.assign(wins[i].style, { left: `${T.x}px`, top: `${T.y}px`, width: `${T.w}px`, height: `${T.h}px` });
    }

    // World: shrinks into the Win+Tab stack. For the 180°, the camera swings
    // up and over the website: the world tips back (rotateX), spins half a turn
    // (rotateZ) and pulls away, so it ends looking straight down on the site
    // lying on the desk. Only the website takes part; the stack is long gone.
    const e = P.stack, d = P.desk;
    const stackScale = lerp(1, 0.56, e);
    const ws = stackScale * lerp(1, 0.62, d);
    const rx = 58 * d;
    const rz = 180 * d;
    world.style.transform = `rotateX(${rx}deg) rotateZ(${rz}deg) scale(${ws})`;
    floor.style.opacity = String(d);

    // Focus: the website leaves the stack and fills the screen (cancelling the
    // stack scale); for customization it steps back a little under the bulb.
    const fo = P.focus;
    const c = P.custom;

    for (let i = 0; i < N; i++) {
      let s = i - P.cycle;
      while (s < -0.5) s += N;                        // wrap: leaving the front → re-enter at the back
      const a = stackPose(s, T);
      let x = a.x * e, y = a.y * e, zz = a.z * e, ry = a.ry * e, k = 1;
      let o = i === 0 && e === 0 ? 1 : a.o * (i === 0 ? 1 : e);
      if (i === FOCUS) {
        x = lerp(x, 0, fo); y = lerp(y, 0, fo); zz = lerp(zz, 0, fo); ry = lerp(ry, 0, fo);
        o = lerp(o, 1, fo);
        k = lerp(1, 1 / stackScale, fo) * lerp(1, 0.72, c);
      } else {
        o *= 1 - fo;                                  // the rest drop out completely
      }
      wins[i].style.transform = `translate3d(${x}px, ${y}px, ${zz}px) rotateY(${ry}deg) scale(${k})`;
      wins[i].style.opacity = String(o);
      wins[i].style.zIndex = String(i === FOCUS && fo > 0 ? 200 : 100 - Math.round(s * 10));
    }

    // Scroll the mini website inside its window, and light/dark mode from the bulb.
    const room = Math.max(0, siteScroll.offsetHeight - siteBody.clientHeight);
    siteScroll.style.transform = `translateY(${-room * P.site}px)`;
    siteBody.classList.toggle('dark', P.dark > 0.5);
  }

  return { P, render };
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

  const stage = $('.journey-stage', section);
  const fallScene = $('#fall');
  const build = $('#sceneBuild');
  const track = $('#buildTrack');
  const card  = $('#editorCard');
  const code  = $('#sceneCode');
  const rise  = $('#sceneRise');
  const end   = $('#sceneEnd');
  const wins  = [$('#editor'), ...$$('.win:not(.editor)', code)];
  const rig = createWindowRig({ stage, card, world: $('#flipWorld'), floor: $('#flipFloor'), wins });

  const master = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: rig.render });

  /* ---- 1 · fall ---------------------------------------------------- */
  const fall = buildFall();
  if (fall) master.add(fall, 0);
  master.addLabel('fallEnd');

  /* ---- 2 · sideways onto the build strip --------------------------- */
  gsap.set(build, { xPercent: 100, autoAlpha: 1 });
  gsap.set(code, { autoAlpha: 0 });
  master
    .set(code, { autoAlpha: 1 }, 'fallEnd')      // the editor rides along over its spacer
    .to(fallScene, { xPercent: -100, duration: S('toBuild'), ease: 'power2.inOut' }, 'fallEnd')
    .to(build, { xPercent: 0, duration: S('toBuild'), ease: 'power2.inOut' }, 'fallEnd')
    .addLabel('strip');

  const travel = () => card.offsetLeft + card.offsetWidth / 2 - window.innerWidth / 2;
  master
    .to(track, { x: () => -travel(), duration: S('strip') }, 'strip')
    .fromTo('.build-grid', { backgroundPosition: '0px 0px' },
      { backgroundPosition: () => `${-travel() * 0.35}px 0px`, duration: S('strip') }, 'strip');

  // Each panel animates as it crosses into view: icon draws, name decodes, details fade up.
  const vw = window.innerWidth;
  $$('.build-panel', track).forEach((panel) => {
    const f = gsap.utils.clamp(0, 0.9, (panel.offsetLeft - vw * 0.8) / travel());
    const at = master.labels.strip + f * S('strip');
    const name = $('.build-name', panel);
    name.setAttribute('aria-label', name.dataset.text);
    name.textContent = '';
    master
      .fromTo($$('.build-icon path, .build-icon rect', panel), { drawSVG: '0%' },
        { drawSVG: '100%', duration: 0.2 * S('strip'), stagger: 0.012 * S('strip'), ease: 'power1.inOut' }, at)
      // Short and with no reveal delay: the letters lock in almost immediately, left to right.
      .to(name, { scrambleText: { text: name.dataset.text, chars: 'upperCase', speed: 1, revealDelay: 0 },
        duration: 0.06 * S('strip') }, at)
      .fromTo($$('p, .chips, .build-num', panel), { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.12 * S('strip'), stagger: 0.02 * S('strip'), ease: 'power2.out' }, at + 0.06 * S('strip'));
  });

  /* ---- 3 · the editor grows out of the strip, then types ------------- */
  master.addLabel('zoom');
  const others = [...track.children].filter((el) => el !== card);
  master
    .to(rig.P, { zoom: 1, duration: S('zoom'), ease: 'power2.inOut' }, 'zoom')
    .to(others, { scale: 1.25, autoAlpha: 0, duration: S('zoom') * 0.7, ease: 'power2.in', transformOrigin: '50% 50%' }, 'zoom')
    .to('.build-grid', { scale: 1.4, autoAlpha: 0, duration: S('zoom'), ease: 'power2.in' }, 'zoom')
    .addLabel('type')
    // Everything behind is covered/gone now; hide it so it can't show through later.
    .set([build, fallScene], { autoAlpha: 0 }, 'type')
    // Once the code has shipped, the editor dims and the big statement takes the screen.
    .fromTo('#codeCaption', { autoAlpha: 0 }, { autoAlpha: 1, duration: S('typeHold') * 0.18 }, `type+=${S('type') * 0.95}`)
    .fromTo('#codeCaption > *', { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: S('typeHold') * 0.3, stagger: S('typeHold') * 0.07, ease: 'power3.out' }, `type+=${S('type') * 0.95}`)
    .fromTo('#codeCaption .one-team-points li', { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: S('typeHold') * 0.15, stagger: S('typeHold') * 0.06, ease: 'back.out(2)' }, `type+=${S('type') * 0.95 + S('typeHold') * 0.3}`);

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
    .fromTo(typer, { n: 0 }, { n: chars.length, duration: S('type') * 0.8, onUpdate: renderTyping }, 'type')
    .fromTo('.term-line', { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: S('type') * 0.1, stagger: S('type') * 0.08 }, `type+=${S('type') * 0.8}`);

  /* ---- 4 · Win+Tab: into the 3D stack, then one full rotation -------- */
  master
    .addLabel('stack', `type+=${S('type') + S('typeHold')}`)
    .to('#codeCaption', { autoAlpha: 0, duration: S('stackIn') * 0.5 }, 'stack')
    .to(rig.P, { stack: 1, duration: S('stackIn'), ease: 'power2.inOut' }, 'stack')
    .addLabel('cycle')
    // The turn starts on its own; the statement comes up mid-turn and clears before the website lands.
    // First third: the turn on its own. Middle: the statement. Last third: the turn lands on the website.
    .to('#stackCaption', { autoAlpha: 1, duration: S('cycle') * 0.06 }, `cycle+=${S('cycle') * 0.36}`)
    .fromTo('#stackCaption > *', { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: S('cycle') * 0.1, stagger: S('cycle') * 0.02, ease: 'power3.out' }, `cycle+=${S('cycle') * 0.36}`)
    .to('#stackCaption', { autoAlpha: 0, duration: S('cycle') * 0.06 }, `cycle+=${S('cycle') * 0.61}`)
    // One full turn plus one: the website window ends up at the front.
    .to(rig.P, { cycle: wins.length + 1, duration: S('cycle'), ease: 'sine.inOut' }, 'cycle')
    // Zoom into the website, then scroll down it like a real page.
    .addLabel('focus')
    .to(rig.P, { focus: 1, duration: S('focus'), ease: 'power2.inOut' }, 'focus')
    .addLabel('site')
    .to(rig.P, { site: 1, duration: S('site'), ease: 'power1.inOut' }, 'site');


  /* ---- 5 · the 180°: camera swings over to look down on the site ------ */
  master
    .addLabel('desk')
    .to(rig.P, { desk: 1, duration: S('desk'), ease: 'power2.inOut' }, 'desk')
    .to({}, { duration: S('deskHold') });

  /* ---- 5a · customization: the lightbulb ------------------------------- */
  const bulbScene = $('#sceneBulb');
  const bulbWorld = $('#bulbWorld');
  const pendulum = $('#bulbPendulum');
  const bulb = $('#bulb');
  const threads = $('#bulbThreads');
  const lightParts = ['#bulbGlow', '#bulbBeam', '#bulbInner'];
  buildBulbStreaks();
  buildDust();
  gsap.set(bulbScene, { autoAlpha: 0 });
  gsap.set(bulbWorld, { y: () => -window.innerHeight * 0.75 });
  gsap.set(pendulum, { rotation: 24 });
  gsap.set(lightParts, { opacity: 0 });
  gsap.set('#bulbCopy > *', { autoAlpha: 0, y: 24 });
  gsap.set('#bulbSpark', { transformOrigin: '50% 50%' });
  const thread = { t: 0 };
  const turnThreads = () => threads.setAttribute('patternTransform', `rotate(-18) translate(0 ${thread.t})`);
  const lamp = { v: 0 };   // 1 = the bulb is lit → the page is in light mode
  const setLamp = () => document.documentElement.classList.toggle('light', lamp.v > 0.5);
  const I = S('bulbIn'), U = S('unscrew'), F = S('bulbFall');

  master
    .addLabel('bulb')
    .to(code, { autoAlpha: 0, scale: 0.92, duration: I * 0.4, ease: 'power2.in' }, 'bulb')
    .to(bulbScene, { autoAlpha: 1, duration: I * 0.2 }, `bulb+=${I * 0.2}`)
    // It drops in from the ceiling on its cord and swings to rest (a damped pendulum).
    .to(bulbWorld, { y: 0, duration: I * 0.45, ease: 'power3.out' }, `bulb+=${I * 0.2}`)
    .to(pendulum, { keyframes: { rotation: [24, -15, 9, -5, 2.5, -1, 0], easeEach: 'sine.inOut' }, duration: I * 0.8 }, `bulb+=${I * 0.2}`)
    // Power on: glow and beam come up — and the whole page lights up.
    .to(lightParts, { opacity: 1, duration: I * 0.12 }, `bulb+=${I * 0.3}`)
    .to(lamp, { v: 1, duration: I * 0.04, onUpdate: setLamp }, `bulb+=${I * 0.32}`)
    .to('#bulbCopy > *', { autoAlpha: 1, y: 0, duration: I * 0.3, stagger: I * 0.08, ease: 'power3.out' }, `bulb+=${I * 0.55}`)
    .addLabel('unscrew', `bulb+=${I + S('bulbHold')}`);

  // Four turns: the threads roll, a highlight slides across the glass, the bulb
  // steps down out of the socket. From the second turn the contact fails and
  // the whole site flickers between light and dark, worse each turn.
  const TURNS = 4, turn = (U * 0.78) / TURNS;
  for (let i = 0; i < TURNS; i++) {
    const at = master.labels.unscrew + i * turn;
    master
      .to(thread, { t: (i + 1) * 9, duration: turn * 0.8, ease: 'power1.inOut', onUpdate: turnThreads }, at)
      .to('#bulbShine', { keyframes: { x: [0, 16, -6, 0] }, duration: turn * 0.8 }, at)
      .to(bulb, { y: (i + 1) * 5, duration: turn * 0.8, ease: 'power1.inOut' }, at)
      .to(bulb, { keyframes: { rotation: [0, -3.5, 3, 0] }, duration: turn * 0.8 }, at);
    if (i >= 1) {
      const dips = i === 1 ? [1, 0.3, 1] : i === 2 ? [1, 0.1, 0.9, 0.2, 1] : [1, 0.05, 0.8, 0, 0.6, 0.1, 1];
      master
        .to(lamp, { keyframes: { v: dips }, duration: turn * 0.5, onUpdate: setLamp }, at + turn * 0.25)
        .to(lightParts, { keyframes: { opacity: dips }, duration: turn * 0.5 }, at + turn * 0.25);
    }
  }

  const loose = master.labels.unscrew + U * 0.82;
  master
    // It comes loose: a spark at the contact and the lights die — the site goes dark.
    .fromTo('#bulbSpark', { scale: 0.3, opacity: 1 }, { scale: 1.6, opacity: 0, duration: U * 0.12, ease: 'power2.out', immediateRender: false }, loose)
    .to(lightParts, { opacity: 0, duration: U * 0.04 }, loose)
    .to(lamp, { v: 0, duration: U * 0.03, onUpdate: setLamp }, loose)
    .to('#bulbGlass', { fill: 'rgba(170, 180, 200, 0.14)', stroke: '#7A8292', duration: U * 0.05 }, loose)
    .to('#bulbFil', { stroke: '#FF6A1A', duration: U * 0.02 }, loose)            // the filament is still hot…
    .addLabel('drop', `unscrew+=${U}`)
    // …and it falls. The empty cord springs back, the ceiling flies away and
    // streaks rush past: the camera falls with the bulb.
    .to('#bulbCopy > *', { autoAlpha: 0, y: -30, duration: F * 0.15, stagger: F * 0.03 }, 'drop')
    .to('#bulbCord', { keyframes: { scaleY: [1, 0.86, 1.05, 0.98, 1] }, duration: F * 0.35 }, 'drop')
    .to('#bulbSocket', { keyframes: { y: [0, -14, 4, -2, 0] }, duration: F * 0.35 }, 'drop')
    .to(bulb, { y: () => window.innerHeight * 2.2, duration: F * 0.95, ease: 'power2.in' }, 'drop')
    .to(bulb, { rotation: 320, duration: F, ease: 'power1.in' }, 'drop')
    .to(bulbWorld, { y: () => -window.innerHeight * 1.8, duration: F * 0.9, ease: 'power1.in' }, `drop+=${F * 0.1}`)
    .to('#bulbFil', { stroke: '#6B7385', duration: F * 0.45 }, `drop+=${F * 0.05}`)   // …cooling as it goes
    .to('#bulbStreaks', { opacity: 1, duration: F * 0.15 }, `drop+=${F * 0.15}`)
    .fromTo('#bulbStreaks', { y: 0 }, { y: () => -window.innerHeight * 2.2, duration: F * 0.85, ease: 'power1.in' }, `drop+=${F * 0.15}`);

  /* ---- 5b · security: refused, shake, lock, through the keyhole ------ */
  const secure = $('#sceneSecure');
  const login = $('#secureLogin');
  const shake = $('#secureShake');
  const flash = $('#secureFlash');
  const err = $('#loginErr');
  const btnMock = $('#loginBtnMock');
  const fields = $$('.login-field', login);
  const lockWrap = $('#lockWrap');
  const lock = $('#lock');
  const copy = $('#secureCopy');

  gsap.set(secure, { autoAlpha: 0 });
  gsap.set(lockWrap, { autoAlpha: 0, y: 260 });
  gsap.set('#lockShackle', { y: -26 });
  gsap.set(copy, { autoAlpha: 0, y: 30 });

  // One refused attempt: password fills, button pressed, red error, flash, and a hard shake.
  const attempt = (at, strength) => {
    const len = S('denied') * 0.45;
    const k = strength;
    master
      .fromTo('#passDots', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: len * 0.35 }, at)
      .to(btnMock, { scale: 0.95, duration: len * 0.06, yoyo: true, repeat: 1 }, at + len * 0.4)
      .fromTo(err, { autoAlpha: 0 }, { autoAlpha: 1, duration: len * 0.05 }, at + len * 0.5)
      .to(fields, { borderColor: '#FF6B6B', duration: len * 0.05 }, at + len * 0.5)
      .fromTo(flash, { opacity: 0 }, { opacity: 0.9, duration: len * 0.08, yoyo: true, repeat: 1 }, at + len * 0.5)
      .to(shake, { keyframes: { x: [0, -26 * k, 24 * k, -20 * k, 16 * k, -11 * k, 7 * k, -3 * k, 0], rotation: [0, -0.6 * k, 0.6 * k, -0.4 * k, 0.3 * k, 0] },
        duration: len * 0.4, ease: 'none' }, at + len * 0.5);
  };

  master
    .addLabel('secure', `drop+=${F}`)
    // Still falling: the bulb drops out of frame and the login page rises from below.
    .set(secure, { autoAlpha: 1, yPercent: 100 }, 'secure')
    .to(bulbScene, { yPercent: -100, duration: S('toSecure'), ease: 'power2.inOut' }, 'secure')
    .to(secure, { yPercent: 0, duration: S('toSecure'), ease: 'power2.inOut' }, 'secure')
    .fromTo(login, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: S('toSecure') * 0.5, ease: 'power3.out' }, `secure+=${S('toSecure') * 0.5}`)
    .set(bulbScene, { autoAlpha: 0 }, `secure+=${S('toSecure')}`)
    .addLabel('denied', `secure+=${S('toSecure')}`);
  attempt(master.labels.denied, 1);
  master
    // clear and try again…
    .to(err, { autoAlpha: 0, duration: S('denied') * 0.03 }, `denied+=${S('denied') * 0.5}`)
    .to(fields, { borderColor: '#323847', duration: S('denied') * 0.03 }, `denied+=${S('denied') * 0.5}`);
  attempt(master.labels.denied + S('denied') * 0.52, 1.5);

  // The lock: the login falls away, the padlock rises, the shackle snaps shut.
  master
    .addLabel('lockUp', `denied+=${S('denied')}`)
    .to(login, { autoAlpha: 0, y: 80, rotation: -4, duration: S('lockUp') * 0.4, ease: 'power2.in' }, 'lockUp')
    .to(lockWrap, { autoAlpha: 1, y: 0, duration: S('lockUp') * 0.5, ease: 'power3.out' }, `lockUp+=${S('lockUp') * 0.25}`)
    .to('#lockShackle', { y: 0, duration: S('lockUp') * 0.18, ease: 'power4.in' }, `lockUp+=${S('lockUp') * 0.72}`)
    .to(shake, { keyframes: { y: [0, 6, 0] }, duration: S('lockUp') * 0.1 }, `lockUp+=${S('lockUp') * 0.9}`)   // the clunk
    .to(copy, { autoAlpha: 1, y: 0, duration: S('lockUp') * 0.35, ease: 'power3.out' }, `lockUp+=${S('lockUp') * 0.55}`)
    // The hold: someone rattles the lock, it doesn't give, and it just sits there.
    .to(lockWrap, { keyframes: { rotation: [0, -6, 5, -3.5, 2, -0.8, 0] }, transformOrigin: '50% 15%', duration: S('lockHold') * 0.3 }, `lockUp+=${S('lockUp') + S('lockHold') * 0.1}`)
    .to(shake, { keyframes: { x: [0, -5, 4, -2, 0] }, duration: S('lockHold') * 0.2 }, `lockUp+=${S('lockUp') + S('lockHold') * 0.15}`);

  // Fly through the keyhole. The lock is first brought to the centre; then a
  // full-screen copy of it (#lockZoom) takes over and the camera pushes in by
  // shrinking that SVG's viewBox around the keyhole. It's redrawn as vectors at
  // every step, so it stays sharp right up until the hole fills the screen.
  const lockZoom = $('#lockZoom');
  const zoomCam = { p: 0 };
  const renderLockZoom = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = lock.getBoundingClientRect();
    const k = r.width / 200;                                   // px per SVG unit, as drawn now
    const hx = (r.left + 100 * k) / vw, hy = (r.top + 150 * k) / vh;   // keyhole centre on screen
    const w0 = vw / k;                                         // viewBox width that matches the small lock
    const w1 = 22 / Math.hypot(1, vh / vw);                    // the hole (r = 14) covers the whole screen
    const w = w0 * Math.pow(w1 / w0, zoomCam.p);               // log-space: a steady push in
    const h = (w * vh) / vw;
    const fx = lerp(hx, 0.5, zoomCam.p), fy = lerp(hy, 0.5, zoomCam.p);
    lockZoom.setAttribute('viewBox', `${100 - fx * w} ${150 - fy * h} ${w} ${h}`);
    const on = zoomCam.p > 0;
    lockZoom.style.visibility = on ? 'visible' : 'hidden';
    lock.style.visibility = on ? 'hidden' : '';
  };
  const keyholeShift = () => window.innerHeight / 2 - (lockWrap.offsetTop + lockWrap.offsetHeight * 0.625);
  master
    .addLabel('keyhole', `lockUp+=${S('lockUp') + S('lockHold')}`)
    .to(copy, { autoAlpha: 0, y: 30, duration: S('keyhole') * 0.3 }, 'keyhole')
    .to(lockWrap, { y: keyholeShift, duration: S('keyhole') * 0.4, ease: 'power2.inOut' }, 'keyhole')
    .fromTo(zoomCam, { p: 0 }, { p: 1, duration: S('keyhole'), ease: 'power2.in', onUpdate: renderLockZoom }, `keyhole+=${S('keyhole') * 0.15}`);

  /* ---- 6 · out through the keyhole: testimonials ---------------------- */
  // Client videos/photos on a 3D carousel that turns with the scroll.
  master.addLabel('up', `keyhole+=${S('keyhole') * 1.15}`);
  gsap.set(rise, { autoAlpha: 0 });
  const quotesScene = $('#sceneQuotes');
  const ring = $('#quotesRing');
  const quotes = $$('.quote', ring);
  const qDots = $$('#quotesDots li');
  const NQ = quotes.length, STEP = 360 / NQ;
  const ringState = { rot: 0 };
  const placeQuotes = () => {
    const w = ring.offsetWidth;
    const R = ((w / 2) / Math.tan(Math.PI / NQ)) * 1.02;   // ring radius that just fits the cards side by side
    const forward = 0;   // the front card sits on the screen plane (pulling it closer blurred it)
    let front = 0, best = 1e9;
    quotes.forEach((q, i) => {
      const a = i * STEP + ringState.rot;                   // this card's angle away from the viewer
      const norm = ((a % 360) + 540) % 360 - 180;           // -180…180, 0 = facing you
      const facing = Math.cos((norm * Math.PI) / 180);      // 1 = front, -1 = back
      q.style.transform = `rotateY(${a}deg) translateZ(${R}px)`;
      q.style.opacity = String(Math.max(0.1, ((facing + 1) / 2) ** 1.8));
      if (Math.abs(norm) < best) { best = Math.abs(norm); front = i; }
    });
    quotes.forEach((q, i) => { const v = q.querySelector('video'); if (v && i !== front && !v.paused) v.pause(); });
    ring.style.transform = `translateZ(${forward - R}px)`;  // the front card sits slightly in front of the screen plane
    qDots.forEach((d, i) => d.classList.toggle('on', i === front));
  };
  gsap.set(quotesScene, { autoAlpha: 0 });
  placeQuotes();
  const TQ = S('toQuotes'), QN = S('quotes'), slotQ = QN / NQ;
  master
    .set(secure, { autoAlpha: 0 }, 'up')              // the keyhole's dark fills the screen: swap scenes under it
    .to(lamp, { v: 0, duration: 0.05, onUpdate: setLamp }, 'up')   // and it's dark on the other side
    .addLabel('quotes', 'up')
    .fromTo(quotesScene, { autoAlpha: 0 }, { autoAlpha: 1, duration: TQ * 0.5 }, `quotes+=${TQ * 0.2}`)
    .fromTo(ringState, { rot: 80 }, { rot: 0, duration: TQ, ease: 'power3.out', onUpdate: placeQuotes }, `quotes+=${TQ * 0.2}`)
    .fromTo('.quotes-head', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: TQ * 0.5, ease: 'power2.out' }, `quotes+=${TQ * 0.4}`)
    .addLabel('quotesIn', `quotes+=${TQ}`);
  for (let k = 1; k < NQ; k++) {
    master.to(ringState, { rot: -STEP * k, duration: slotQ * 0.55, ease: 'power2.inOut', onUpdate: placeQuotes },
      master.labels.quotes + TQ + (k - 1) * slotQ + slotQ * 0.4);
  }

  /* ---- 6b · how we work, one step per screen ------------------------- */
  // The camera keeps rising: each step arrives from above and the last one
  // drops away below. Its line art draws itself, a giant outlined word drifts
  // behind it, and the progress bar along the bottom fills left → right.
  const steps = $$('.rstep', rise);
  const prog = $$('#riseProgress li');
  const setActive = (n) => prog.forEach((li, i) => { li.classList.toggle('done', i < n); li.classList.toggle('on', i === n); });
  const stepAt = { n: 0 };
  const onStep = () => setActive(Math.round(stepAt.n));
  setActive(0);
  gsap.set(steps, { yPercent: -100 });
  gsap.set(steps[0], { yPercent: 0, autoAlpha: 0 });

  master
    .addLabel('rise', `quotes+=${TQ + QN}`)
    .to(quotesScene, { autoAlpha: 0, scale: 0.94, duration: S('toRise') * 0.5, ease: 'power2.in' }, 'rise')
    .to(rise, { autoAlpha: 1, duration: S('toRise') * 0.4 }, `rise+=${S('toRise') * 0.3}`)
    .fromTo('#riseStars', { y: 0 }, { y: () => window.innerHeight * 0.9, duration: S('toRise') + S('climb') }, 'rise')
    .fromTo('#riseStatement', { autoAlpha: 0 }, { autoAlpha: 1, duration: S('toRise') * 0.3 }, `rise+=${S('toRise') * 0.35}`)
    .fromTo('#riseStatement > *', { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: S('riseHold') * 0.3, stagger: S('riseHold') * 0.06, ease: 'power3.out' }, `rise+=${S('toRise') * 0.35}`)
    .addLabel('climb', `rise+=${S('toRise') + S('riseHold')}`)
    // The statement steps aside; the chapter label and progress bar come in with the first step.
    .to('#riseStatement', { autoAlpha: 0, y: -40, duration: S('riseHold') * 0.2, ease: 'power2.in' }, `climb-=${S('riseHold') * 0.22}`)
    .fromTo('.rise-head', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: S('riseHold') * 0.2, ease: 'power2.out' }, `climb-=${S('riseHold') * 0.05}`)
    .fromTo('.rise-progress', { autoAlpha: 0 }, { autoAlpha: 1, duration: S('riseHold') * 0.2 }, `climb-=${S('riseHold') * 0.05}`);

  const C = S('climb'), slot = C / steps.length;
  steps.forEach((st, k) => {
    const at = master.labels.climb + k * slot;
    if (k > 0) {
      master
        .to(steps[k - 1], { yPercent: 100, duration: slot * 0.32, ease: 'power2.inOut' }, at)
        .fromTo(st, { yPercent: -100 }, { yPercent: 0, duration: slot * 0.32, ease: 'power2.inOut' }, at)
        .to('#riseFill', { scaleX: (k + 1) / steps.length, duration: slot * 0.3, ease: 'power2.inOut' }, at)
        .to(stepAt, { n: k, duration: slot * 0.02, onUpdate: onStep }, at + slot * 0.16);
    }
    const show = k === 0 ? master.labels.climb : at + slot * 0.18;
    if (k === 0) master.fromTo(st, { autoAlpha: 0 }, { autoAlpha: 1, duration: slot * 0.12 }, show - slot * 0.05);
    master
      .fromTo($$('.rstep-art > *:not(g), .rstep-art g > *', st), { drawSVG: '0%' },
        { drawSVG: '100%', duration: slot * 0.45, stagger: slot * 0.035, ease: 'power1.inOut' }, show)
      .fromTo($$('.rstep-copy > *', st), { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: slot * 0.25, stagger: slot * 0.05, ease: 'power3.out' }, show + slot * 0.05)
      .fromTo($('.rstep-bg', st), { xPercent: 10 }, { xPercent: -10, duration: slot * 1.3 }, show - slot * 0.1);
  });

  // Launch: the rocket lifts off (flame flickers as it goes).
  const rocketAt = master.labels.climb + 3 * slot + slot * 0.6;
  master
    .to('.rstep-rocket', { y: -46, duration: slot * 0.35, ease: 'power2.in' }, rocketAt)
    .to('.rstep-flame', { keyframes: { scaleY: [1, 1.5, 1.1, 1.7, 1.3] }, transformOrigin: '50% 0%', duration: slot * 0.35 }, rocketAt);

  /* ---- 7 · finale ------------------------------------------------------ */
  const fin = createFinale({ canvas: $('#endCanvas'), mark: $('#endMark'), orbit: $('#endOrbit'), stage, scene: end });
  const titleSplit = SplitText.create('#endTitle', { type: 'chars', charsClass: 'char' });
  gsap.set(end, { autoAlpha: 0 });
  gsap.set(['.end-sub', '.end-cta'], { autoAlpha: 0, y: 24 });
  gsap.set(titleSplit.chars, { autoAlpha: 0 });
  const E = S('toEnd'), RV = S('reveal');
  const rnd = gsap.utils.random;

  master
    // The last step falls away and the stars take over.
    .addLabel('out', `climb+=${S('climb')}`)
    .to(rise, { autoAlpha: 0, scale: 0.94, duration: E * 0.6, ease: 'power2.in' }, 'out')
    .fromTo(end, { autoAlpha: 0 }, { autoAlpha: 1, duration: E * 0.6, ease: 'power1.out' }, `out+=${E * 0.35}`)
    // Warp: the stars stretch into streaks and back.
    .addLabel('warp', `out+=${E}`)
    .fromTo(fin.P, { warp: 0 }, { warp: 1, duration: S('warp'), ease: 'power1.inOut' }, 'warp')
    // The stars swirl in and assemble the logo; the solid mark settles over them.
    .addLabel('form', `warp+=${S('warp')}`)
    .fromTo(fin.P, { form: 0 }, { form: 1, duration: S('form') }, 'form')
    .fromTo(fin.P, { orbitIn: 0 }, { orbitIn: 1, duration: S('form') * 0.3 }, `form+=${S('form') * 0.7}`)
    .fromTo(fin.P, { orbit: 0 }, { orbit: 1, duration: S('form') * 0.3 + RV + S('hold') }, `form+=${S('form') * 0.7}`)
    // The headline flies together letter by letter, then the call to action.
    .addLabel('reveal', `form+=${S('form')}`)
    .fromTo(titleSplit.chars,
      { autoAlpha: 0, x: () => rnd(-320, 320), y: () => rnd(-220, 220), z: () => rnd(-700, 150), rotationX: () => rnd(-120, 120), rotationY: () => rnd(-90, 90) },
      { autoAlpha: 1, x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, duration: RV * 0.6, stagger: RV * 0.025, ease: 'power3.out' }, 'reveal')
    .to(['.end-sub', '.end-cta'], { autoAlpha: 1, y: 0, duration: RV * 0.3, stagger: RV * 0.1, ease: 'power3.out' }, `reveal+=${RV * 0.55}`)
    .to({}, { duration: S('hold') });

  master.eventCallback('onUpdate', () => { rig.render(); fin.render(); });

  if (import.meta.env.DEV) window.__journey = master;   // for tuning in the console

  const st = ScrollTrigger.create({
    animation: master,
    trigger: section,
    start: 'top top',
    end: () => '+=' + (master.duration() / SCREEN) * window.innerHeight,
    pin: true,
    scrub: SCRUB,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefresh: () => { rig.render(); fin.resize(); placeQuotes(); },
  });
  rig.render();
  fin.resize();

  // Header links (data-chapter) jump the scroll story to that chapter. Captured at the
  // document so the generic #anchor scrolling in main.js doesn't also fire.
  const jumpTo = (label) => {
    const t = master.labels[label];
    if (t === undefined) return;
    const y = st.start + (t / master.duration()) * (st.end - st.start);
    gsap.to(window, { scrollTo: y + 1, duration: 1.4, ease: 'power2.inOut' });
  };
  const HASH = { '#services': 'strip', '#work': 'focus', '#security': 'denied', '#testimonials': 'quotesIn', '#process': 'climb' };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const chapter = a.dataset.chapter || HASH[a.hash];
    const samePage = a.pathname === location.pathname || a.getAttribute('href').startsWith('#');
    if (!chapter || !samePage) return;
    e.preventDefault();
    e.stopPropagation();
    if (document.body.classList.contains('menu-open')) $('#menuToggle')?.click();
    jumpTo(chapter);
  }, true);
  // Arriving from another page on a deep link (e.g. about.html → ./#process).
  // Wait for full load (fonts, video poster, layout) so the browser's own
  // anchor jump and ScrollTrigger's refresh can't reset the position after us.
  if (HASH[location.hash]) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const land = () => {
      ScrollTrigger.refresh();
      const y = st.start + (master.labels[HASH[location.hash]] / master.duration()) * (st.end - st.start);
      window.scrollTo(0, y + 1);
    };
    if (document.readyState === 'complete') setTimeout(land, 60);
    else window.addEventListener('load', () => setTimeout(land, 60), { once: true });
  }

  // Clicking "Scroll to get started" plays the fall for you.
  $('#scrollCue')?.addEventListener('click', () => {
    const y = st.start + (master.labels.fallEnd / master.duration()) * (st.end - st.start);
    gsap.to(window, { scrollTo: y, duration: 1.6, ease: 'power1.inOut' });
  });
}
