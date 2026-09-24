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
     5a. bulb   💡 a lit bulb swings in and lights the page up (light mode); it
                   unscrews, the lights go out (back to dark) and it falls —
                   the camera follows it down
     5a½ switch    it lands by a wall switch; a hand flips it (lights on) and
                   the flick whips the camera up to the login page
     5b. secure    a sign-in is refused (screen shakes), a padlock rises, and
                   the camera flies through the keyhole
     6. rise    ↑  camera climbs past the process steps, which flip down in 3D
     7. end     ⊖  zoom out onto the call to action

   Chapter lengths live in LEN (in screens of scroll). Lower = more sensitive.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { buildFall } from './fall.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, ScrambleTextPlugin);

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
  stackIn: 0.5,           // editor tilts back into the Win+Tab stack
  cycle:   1.8,           // windows cycle to the front (a full turn, landing on the website)
  focus:   0.7,           // zoom into the website window
  site:    1.5,           // scroll down the website inside it
  desk:    1.1,           // camera swings over 180° to look down on the site
  deskHold: 0.3,
  bulbIn:  0.7,           // a lit bulb swings in; the page lights up
  unscrew: 1.1,           // it unscrews… and the lights go out (dark mode)
  bulbFall: 1.3,          // it falls; the camera follows it down
  toSwitch: 0.6,          // …onto a wall switch in the dark
  flick:   1.0,           // a hand flips it — lights on
  flipUp:  0.7,           // the flick whips the camera up to the login page
  toSecure: 0.6,          // desk fades back, a sign-in screen comes up
  denied:  1.1,           // two refused sign-ins; the screen shakes
  lockUp:  0.9,           // a padlock rises and snaps shut
  keyhole: 0.9,           // fly through the keyhole
  toRise:  0.7,           // out the other side into the climb
  climb:   1.8,           // climb past the steps
  out:     0.7,           // zoom out onto the call to action
  hold:    0.25,
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
    editor.classList.toggle('is-small', ew < 640);
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
  const riseTrack = $('#riseTrack');
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
      .to(name, { scrambleText: { text: name.dataset.text, chars: 'upperCase', speed: 0.5, revealDelay: 0.3 },
        duration: 0.18 * S('strip') }, at + 0.04 * S('strip'))
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
    .fromTo('#codeCaption', { autoAlpha: 0 }, { autoAlpha: 1, duration: S('type') * 0.2 }, 'type');

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
    .addLabel('stack', `type+=${S('type')}`)
    .to('#codeCaption', { autoAlpha: 0, duration: S('stackIn') * 0.5 }, 'stack')
    .to(rig.P, { stack: 1, duration: S('stackIn'), ease: 'power2.inOut' }, 'stack')
    .addLabel('cycle')
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

  /* ---- 5a · customization: unscrew → lights out → fall ---------------- */
  const bulbScene = $('#sceneBulb');
  const bulb = $('#bulb');
  const bulbRig = $('#bulbRig');
  const threads = $('#bulbThreads');
  buildBulbStreaks();
  gsap.set(bulbScene, { autoAlpha: 0 });
  gsap.set([bulbRig, bulb], { y: () => -window.innerHeight * 0.5 });
  gsap.set('#bulbCopy', { autoAlpha: 0, y: 24 });
  const thread = { t: 0 };
  const turnThreads = () => threads.setAttribute('patternTransform', `rotate(-18) translate(0 ${thread.t})`);
  const lamp = { v: 0 };   // 1 = the bulb's light is on → the page is in light mode
  const setLamp = () => document.documentElement.classList.toggle('light', lamp.v > 0.5);
  const U = S('unscrew'), F = S('bulbFall');
  master
    .addLabel('bulb')
    .to(code, { autoAlpha: 0, scale: 0.92, duration: S('bulbIn') * 0.6, ease: 'power2.in' }, 'bulb')
    .to(bulbScene, { autoAlpha: 1, duration: S('bulbIn') * 0.4 }, `bulb+=${S('bulbIn') * 0.3}`)
    .to([bulbRig, bulb], { y: 0, duration: S('bulbIn') * 0.7, ease: 'back.out(1.4)' }, `bulb+=${S('bulbIn') * 0.3}`)
    .to('#bulbCopy', { autoAlpha: 1, y: 0, duration: S('bulbIn') * 0.4, ease: 'power3.out' }, `bulb+=${S('bulbIn') * 0.6}`)
    // The bulb swings into place lit — the whole page lights up to light mode.
    .to(lamp, { v: 1, duration: S('bulbIn') * 0.05, onUpdate: setLamp }, `bulb+=${S('bulbIn') * 0.55}`)
    // Unscrewing: the threads roll, the bulb wobbles and steps down out of the socket, the light stutters.
    .addLabel('unscrew', `bulb+=${S('bulbIn')}`)
    .to(thread, { t: 36, duration: U * 0.8, onUpdate: turnThreads }, 'unscrew')
    .to(bulb, { keyframes: { rotation: [0, -5, 5, -5, 5, -4, 4, 0] }, duration: U * 0.8 }, 'unscrew')
    .to(bulb, { y: 22, duration: U * 0.8, ease: 'steps(6)' }, 'unscrew')
    .to('#bulbGlow', { keyframes: { opacity: [1, 1, 0.7, 1, 0.35, 0.9, 0.2] }, duration: U * 0.8 }, 'unscrew')
    // It comes loose — lights out: the whole site drops back to dark mode.
    .to('#bulbGlow', { opacity: 0, duration: U * 0.05 }, `unscrew+=${U * 0.82}`)
    .to('#bulbGlass', { fill: '#3A4050', stroke: '#565E70', duration: U * 0.05 }, `unscrew+=${U * 0.82}`)
    .to('#bulbFil', { stroke: '#6B7385', duration: U * 0.05 }, `unscrew+=${U * 0.82}`)
    .to(lamp, { v: 0, duration: U * 0.04, onUpdate: setLamp }, `unscrew+=${U * 0.82}`)
    // …and it falls. The ceiling flies away upward and streaks rush past while
    // the bulb stays in frame: the camera is falling with it.
    .addLabel('drop', `unscrew+=${U}`)
    .to('#bulbCopy', { autoAlpha: 0, y: -30, duration: F * 0.2 }, 'drop')
    .to(bulbRig, { y: () => -window.innerHeight * 0.8, duration: F * 0.45, ease: 'power2.in' }, 'drop')
    .to(bulb, { y: () => window.innerHeight * 0.3, duration: F * 0.35, ease: 'power2.in' }, 'drop')
    .to(bulb, { rotation: 260, duration: F }, 'drop')
    .to('#bulbStreaks', { opacity: 1, duration: F * 0.15 }, `drop+=${F * 0.15}`)
    .fromTo('#bulbStreaks', { y: 0 }, { y: () => -window.innerHeight * 2.2, duration: F * 0.85, ease: 'power1.in' }, `drop+=${F * 0.15}`)
    .to(bulb, { y: () => window.innerHeight * 1.2, duration: F * 0.3, ease: 'power2.in' }, `drop+=${F * 0.7}`)
    .to('#bulbStreaks', { opacity: 0, duration: F * 0.15 }, `drop+=${F * 0.85}`);

  /* ---- 5a½ · the switch: a hand flips it — lights on ----------------- */
  const switchScene = $('#sceneSwitch');
  const hand = $('#hand');
  gsap.set(switchScene, { autoAlpha: 0 });
  gsap.set(hand, { y: () => window.innerHeight * 0.6 });
  const TOUCH = 27;          // hand y where the fingertip meets the lever (down); flipping it up is 28px
  const K = S('flick');
  master
    .addLabel('switch', `drop+=${F}`)
    // Still falling after the bulb: the wall with the switch rises into view.
    .set(switchScene, { autoAlpha: 1 }, 'switch')
    .fromTo(switchScene, { yPercent: 100 }, { yPercent: 0, duration: S('toSwitch'), ease: 'power3.out' }, 'switch')
    .to(bulbScene, { yPercent: -100, duration: S('toSwitch'), ease: 'power3.out' }, 'switch')
    .addLabel('flick', `switch+=${S('toSwitch')}`)
    .to(hand, { y: TOUCH, duration: K * 0.45, ease: 'power2.out' }, 'flick')                    // reach up
    .to(hand, { y: TOUCH - 28, duration: K * 0.12, ease: 'power2.in' }, `flick+=${K * 0.5}`)   // push
    .to('#switchLever', { y: 0, duration: K * 0.08, ease: 'power3.in' }, `flick+=${K * 0.54}`) // click
    .to(lamp, { v: 1, duration: K * 0.04, onUpdate: setLamp }, `flick+=${K * 0.62}`)         // lights on
    .fromTo('#switchHint', { autoAlpha: 0 }, { autoAlpha: 1, duration: K * 0.1 }, `flick+=${K * 0.64}`)
    .to(hand, { y: TOUCH + 70, duration: K * 0.25, ease: 'power2.in' }, `flick+=${K * 0.74}`);

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
    .addLabel('secure', `flick+=${K}`)
    .set(bulbScene, { autoAlpha: 0 }, 'secure')   // long gone above
    // The flick whips the camera up: the switch wall drops away below, the login comes down from above.
    .set(secure, { autoAlpha: 1, yPercent: -100 }, 'secure')
    .to(switchScene, { yPercent: 100, duration: S('flipUp'), ease: 'power3.inOut' }, 'secure')
    .to(secure, { yPercent: 0, duration: S('flipUp'), ease: 'power3.inOut' }, 'secure')
    .fromTo(login, { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: S('flipUp') * 0.5, ease: 'power3.out' }, `secure+=${S('flipUp') * 0.5}`)
    .addLabel('denied', `secure+=${S('flipUp')}`);
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
    .to(copy, { autoAlpha: 1, y: 0, duration: S('lockUp') * 0.35, ease: 'power3.out' }, `lockUp+=${S('lockUp') * 0.55}`);

  // Fly through the keyhole: bring it to the centre and scale around it until
  // its dark opening fills the screen; the climb is on the other side.
  const keyholeShift = () => window.innerHeight / 2 - (lockWrap.offsetTop + lockWrap.offsetHeight * 0.625);
  master
    .addLabel('keyhole', `lockUp+=${S('lockUp')}`)
    .to(copy, { autoAlpha: 0, y: 30, duration: S('keyhole') * 0.3 }, 'keyhole')
    .to(lockWrap, { y: keyholeShift, duration: S('keyhole') * 0.4, ease: 'power2.inOut' }, 'keyhole')
    .fromTo(lock, { scale: 1 }, { scale: 90, transformOrigin: '50% 62.5%', duration: S('keyhole'), ease: 'power3.in' }, `keyhole+=${S('keyhole') * 0.15}`);

  /* ---- 6 · out through the keyhole into the climb ------------------- */
  master.addLabel('up', `keyhole+=${S('keyhole') * 1.15}`);
  gsap.set(rise, { autoAlpha: 0 });
  const climb = () => Math.max(0, riseTrack.offsetHeight - window.innerHeight);
  master
    .set(secure, { autoAlpha: 0 }, 'up')              // the keyhole's dark fills the screen: swap scenes under it
    .to(lamp, { v: 0, duration: 0.05, onUpdate: setLamp }, 'up')   // and it's dark on the other side
    .to(rise, { autoAlpha: 1, duration: S('toRise') * 0.35 }, 'up')
    .fromTo('#riseStars', { y: 0 }, { y: () => window.innerHeight * 0.9, duration: S('toRise') + S('climb') }, 'up')
    .fromTo('.rise-head', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: S('toRise') * 0.5, ease: 'power2.out' }, `up+=${S('toRise') * 0.5}`)
    // Pinned to the end of the tilt, not appended: the stars' drift spans both chapters.
    .addLabel('climb', `up+=${S('toRise')}`)
    .fromTo(riseTrack, { y: () => -climb() }, { y: 0, duration: S('climb') }, 'climb')
    .fromTo('#riseFill', { scaleY: 0 }, { scaleY: 1, duration: S('climb') }, 'climb');

  // Steps flip down into place as they come in over the top edge.
  const vh = window.innerHeight;
  $$('.rise-step', riseTrack).forEach((step) => {
    const f = 1 - (step.offsetTop + step.offsetHeight - vh * 0.1) / climb();
    const at = f <= 0
      ? master.labels.up + S('toRise') * 0.55
      : master.labels.climb + Math.min(f, 0.85) * S('climb');
    master.fromTo(step, { rotationX: 80, autoAlpha: 0, transformOrigin: '50% 0%' },
      { rotationX: 0, autoAlpha: 1, duration: 0.2 * S('climb'), ease: 'power3.out' }, at);
  });

  /* ---- 7 · zoom out onto the call to action -------------------------- */
  master.addLabel('out', `climb+=${S('climb')}`);
  master
    .to(rise, { scale: 0.55, borderRadius: 32, autoAlpha: 0, duration: S('out'), ease: 'power2.inOut' }, 'out')
    .fromTo(end, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: S('out') * 0.8, ease: 'power2.out' }, `out+=${S('out') * 0.2}`)
    .fromTo(['.end-mark', '.end-title', '.end-sub', '#sceneEnd .btn'], { autoAlpha: 0, y: 30 },
      { autoAlpha: 1, y: 0, duration: S('out') * 0.4, stagger: S('out') * 0.1, ease: 'power3.out' }, `out+=${S('out') * 0.45}`)
    .to({}, { duration: S('hold') });

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
    onRefresh: rig.render,
  });
  rig.render();

  // Clicking "Scroll to get started" plays the fall for you.
  $('#scrollCue')?.addEventListener('click', () => {
    const y = st.start + (master.labels.fallEnd / master.duration()) * (st.end - st.start);
    gsap.to(window, { scrollTo: y, duration: 1.6, ease: 'power1.inOut' });
  });
}
