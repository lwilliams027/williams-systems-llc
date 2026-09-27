/* =====================================================================
   Play mode (testing): one scroll plays the story to its next key point.

   Normally the stories scrub: the animation follows the scroll bar. In
   play mode a single wheel flick, swipe or arrow key inside a story plays
   it forward (or back) to the next key point on its own, then waits for
   the next scroll. Outside the story the page scrolls normally.

   Turn it on with ?play in the address (it sticks for the visit), and
   off again with ?play=0.
   ===================================================================== */
import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(Observer, ScrollToPlugin);

export const PLAY = (() => {
  const q = new URLSearchParams(location.search).get('play');
  try {
    if (q === '0') sessionStorage.removeItem('ws-play');
    else if (q !== null) sessionStorage.setItem('ws-play', '1');
    return sessionStorage.getItem('ws-play') === '1';
  } catch { return q !== null && q !== '0'; }
})();

/**
 * st      the story's ScrollTrigger
 * points  () => the key points, in order (recomputed on every step, so resizes are
 *         fine): scroll positions, or { y, speed } where speed stretches the step
 *         that arrives there (see play-speeds.js). The story's start and end are added.
 */
export function playMode(st, points) {
  if (!PLAY) return;
  let releasing = false;
  let goal = null;                                                              // the stop we're heading to, while a play is running
  const stops = () => {
    const list = [st.start, ...points(), st.end]
      .map((p) => (typeof p === 'number' ? { y: p, speed: 1 } : p))
      .map((p) => ({ y: Math.round(p.y), speed: p.speed || 1 }))
      .sort((a, b) => a.y - b.y);
    return list.filter((p, i) => i === 0 || p.y - list[i - 1].y > 40);        // drop near-duplicates
  };
  // counts as inside from a little above the story (it may start just under the header)
  const inside = () => window.scrollY >= st.start - window.innerHeight * 0.25 && window.scrollY <= st.end + 2;

  const step = (dir) => {
    if (releasing || !inside()) return;
    // scrolling again mid-play goes on from where this play is heading, straight away
    const y = goal ?? window.scrollY, list = stops();
    const from = Math.max(y, st.start);                                          // above the start: the first flick plays into the story
    const stop = dir > 0 ? list.find((p) => p.y > from + 4) : [...list].reverse().find((p) => p.y < y - 4 && y > st.start + 4);
    // past either end: let go and carry on scrolling the page normally
    if (stop === undefined) { release(dir); return; }
    const target = stop.y;
    goal = target;
    const dist = Math.abs(target - window.scrollY);
    // two rounds of "25% slower" than the quickest version (0.45–1.3 s): about 0.7–2 s a step,
    // then stretched per animation (play-speeds.js); going back uses the same speed
    const back = dir < 0 ? list.find((p) => p.y > target + 4) : null;
    const speed = (dir > 0 ? stop.speed : back?.speed) || 1;
    const duration = gsap.utils.clamp(0.45, 1.3, dist / (window.innerHeight * 2.6)) * 1.25 * 1.25 * speed;
    gsap.to(window, {
      scrollTo: { y: target, autoKill: false }, duration, ease: 'power1.inOut', overwrite: true,
      onComplete: () => { goal = null; },
    });
  };

  const release = (dir) => {
    releasing = true;
    goal = null;
    obs.disable();
    const y = dir > 0 ? st.end + Math.round(window.innerHeight * 0.6) : Math.max(0, st.start - Math.round(window.innerHeight * 0.6));
    gsap.to(window, { scrollTo: { y, autoKill: false }, duration: 0.8, ease: 'power2.inOut', overwrite: true, onComplete: () => { releasing = false; } });
  };

  // One gesture = one step. A trackpad or phone flick keeps sending scroll events for
  // a second or so (momentum); those arrive back to back, so only an event after a
  // short gap counts as a new scroll. No lock-out: the next scroll works right away.
  let lastEvent = 0;
  const gesture = (dir) => {
    const now = performance.now();
    const fresh = now - lastEvent > 180;
    lastEvent = now;
    if (fresh) step(dir);
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
