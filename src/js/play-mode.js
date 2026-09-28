/* =====================================================================
   Play mode (testing): one scroll plays the story to its next key point.

   Normally the stories scrub: the animation follows the scroll bar. In
   play mode a single wheel flick, swipe or arrow key inside a story plays
   it forward (or back) to the next key point on its own, then waits for
   the next scroll. Outside the story the page scrolls normally.

   It's on by default. ?play=0 turns it off (it sticks for the visit),
   and ?play turns it back on.
   ===================================================================== */
import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(Observer, ScrollToPlugin);

export const PLAY = (() => {
  const q = new URLSearchParams(location.search).get('play');
  try {
    if (q !== null) sessionStorage.setItem('ws-play', q === '0' ? '0' : '1');
    return sessionStorage.getItem('ws-play') !== '0';
  } catch { return q !== '0'; }
})();

/**
 * st      the story's ScrollTrigger
 * points  () => the key points, in order (recomputed on every step, so resizes are
 *         fine): scroll positions, or { y, speed } where speed stretches the step
 *         that arrives there (see play-speeds.js). The story's start and end are added.
 * opts    { end: false }: no stop at the story's very end; the scroll after the last
 *         point carries straight on down the page.
 *         { scale: 1.25 }: every step on the page 25% slower.
 */
export function playMode(st, points, opts = {}) {
  if (!PLAY) return;
  let releasing = false;
  let goal = null;                                                              // the stop we're heading to, while a play is running
  const stops = () => {
    const list = [st.start, ...points(), ...(opts.end === false ? [] : [st.end])]
      .map((p) => (typeof p === 'number' ? { y: p, speed: 1 } : p))
      // a speed can also be { seconds, ease }: a fixed length and a steady pace, for a step with lots in it (like the typing)
      .map((p) => ({ y: Math.round(p.y), ...(typeof p.speed === 'object' ? { speed: 1, ...p.speed } : { speed: p.speed || 1 }) }))
      .sort((a, b) => a.y - b.y);
    return list.filter((p, i) => i === 0 || p.y - list[i - 1].y > 40);        // drop near-duplicates
  };
  // counts as inside from a little above the story (it may start just under the header)
  const inside = () => window.scrollY >= st.start - window.innerHeight * 0.25 && window.scrollY <= st.end + 2;

  // ---- the playhead ------------------------------------------------------------
  // A play is a path of segments (one per step, or one per phase), each with its own
  // length in seconds. The playhead runs along it at a speed (1 = as tuned in
  // play-speeds.js) that rises from rest, and brakes smoothly into the last stop.
  // Keep scrolling (or hold the scroll, like holding a key) while it plays and that
  // same section speeds up: no restart, no jolt, and it never runs on into the next
  // one. The speed climbs while you keep going, then eases back down into the stop.
  const BASE = 1.25;     // cruising speed of a single step (the ramps eat the difference)
  const ACCEL = 5;       // how fast it gets up to cruising speed (per second)
  const BOOST = 3;       // how fast it speeds up beyond that while you keep scrolling
  const BRAKE = 5;       // how firmly it slows into the stop
  let run = null;        // { dir, segs:[{from,to,sec,t0}], T, tau, m, mMax, extra }

  // the segments that play from y to the stop, going dir
  const segsTo = (y, stop, dir, list) => {
    const back = dir < 0 ? list.find((p) => p.y > stop.y + 4) : null;
    const arriving = (dir > 0 ? stop : back) || {};
    if (dir > 0 && arriving.phases) {
      const out = [];
      let from = y;
      arriving.phases.filter((ph) => ph.y > y + 2 || ph === arriving.phases[arriving.phases.length - 1])
        .forEach((ph) => { out.push({ from, to: ph.y, sec: ph.seconds * (opts.scale || 1) }); from = ph.y; });
      if (out.length) out[out.length - 1].to = stop.y;
      return out;
    }
    const dist = Math.abs(stop.y - y);
    // two rounds of "25% slower" than the quickest version (0.45–1.3 s), then stretched
    // per animation (play-speeds.js); going back uses the same speed
    const sec = arriving.seconds || gsap.utils.clamp(0.45, 1.3, dist / (window.innerHeight * 2.6)) * 1.25 * 1.25 * (arriving.speed || 1);
    return [{ from: y, to: stop.y, sec: sec * (opts.scale || 1) }];
  };
  const nextStop = (y, dir, list) => (dir > 0
    ? list.find((p) => p.y > Math.max(y, st.start) + 4)
    : [...list].reverse().find((p) => p.y < y - 4 && y > st.start + 4));

  const addSegs = (segs) => {
    for (const g of segs) { g.t0 = run.T; run.T += Math.max(0.05, g.sec); run.segs.push(g); }
    goal = run.segs[run.segs.length - 1].to;
  };
  const yAt = (tau) => {
    for (const g of run.segs) {
      const len = Math.max(0.05, g.sec);
      if (tau <= g.t0 + len) return g.from + (g.to - g.from) * ((tau - g.t0) / len);
    }
    return run.segs[run.segs.length - 1].to;
  };

  const tick = (_time, deltaMs) => {
    if (!run) return;
    if (gsap.isTweening(window)) { run = null; goal = null; return; }        // something else took the page (e.g. Skip)
    const dt = Math.min(0.05, deltaMs / 1000);
    const k = opts.scale || 1;                                                 // a slower page ramps up and down more gently too
    const want = Math.min(run.mMax, Math.sqrt(2 * (BRAKE / k) * Math.max(0, run.T - run.tau)));
    if (run.m < want) run.m = Math.min(want, run.m + (run.m < BASE ? ACCEL / k : BOOST) * dt);
    else run.m = want;
    run.tau = Math.min(run.T, run.tau + Math.max(0.12, run.m) * dt);
    window.scrollTo(0, yAt(run.tau));
    if (run.tau >= run.T) { run = null; goal = null; }
  };
  gsap.ticker.add(tick);

  const step = (dir) => {
    if (releasing || !inside()) return;
    const list = stops();
    // already playing this way: speed this section up (up to 2.4×), don't add another
    if (run && run.dir === dir) {
      run.extra++;
      run.mMax = BASE * Math.min(2.4, 1 + 0.3 * run.extra);
      return;
    }
    // a fresh play (or a change of direction): start from where it is now
    gsap.killTweensOf(window);
    const y = window.scrollY;
    const stop = nextStop(y, dir, list);
    // past either end: let go and carry on scrolling the page normally
    if (stop === undefined) { run = null; release(dir); return; }
    run = { dir, segs: [], T: 0, tau: 0, m: 0, mMax: BASE, extra: 0 };
    addSegs(segsTo(y, stop, dir, list));
  };

  const release = (dir) => {
    releasing = true;
    run = null;
    goal = null;
    obs.disable();
    const y = dir > 0 ? st.end + Math.round(window.innerHeight * 0.6) : Math.max(0, st.start - Math.round(window.innerHeight * 0.6));
    gsap.to(window, { scrollTo: { y, autoKill: false }, duration: 0.8, ease: 'power2.inOut', overwrite: true, onComplete: () => { releasing = false; } });
  };

  // One gesture = one step. A new scroll after a short gap is a new gesture. A scroll
  // that keeps going (a held wheel, a long drag) repeats like a held key: after a
  // moment it speeds the section up, and keeps doing so a little faster.
  let lastEvent = 0, holdStart = 0, lastRepeat = 0;
  const gesture = (dir) => {
    const now = performance.now();
    const fresh = now - lastEvent > 180;
    lastEvent = now;
    if (fresh) { holdStart = lastRepeat = now; step(dir); return; }
    const held = now - holdStart;
    // (only while a section is playing: holding on never starts the next one)
    if (run && held > 450 && now - lastRepeat > (held > 1600 ? 230 : 380)) { lastRepeat = now; step(dir); }
  };
  // wheelSpeed -1 so a wheel down and a finger swipe up are both "up" (= forward)
  const obs = Observer.create({
    target: window, type: 'wheel,touch', wheelSpeed: -1, tolerance: 10, preventDefault: true,
    onUp: () => gesture(1), onDown: () => gesture(-1),
  });
  window.addEventListener('keydown', (e) => {
    if (!obs.isEnabled) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
  });
  // take over only while the story is on screen; hand back the page outside it
  const sync = () => { if (releasing || goal !== null) return; if (inside()) obs.enable(); else obs.disable(); };
  window.addEventListener('scroll', sync, { passive: true });
  ScrollTrigger.addEventListener('refresh', sync);                           // positions are only known once measured
  sync();
}
