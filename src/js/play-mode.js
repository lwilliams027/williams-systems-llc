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
 * points  () => scroll positions of the key points, in order (recomputed on
 *         every step, so resizes are fine). The story's start and end are added.
 */
export function playMode(st, points) {
  if (!PLAY) return;
  let busy = false;
  const stops = () => {
    const list = [st.start, ...points(), st.end].map(Math.round).sort((a, b) => a - b);
    return list.filter((y, i) => i === 0 || y - list[i - 1] > 40);            // drop near-duplicates
  };
  // counts as inside from a little above the story (it may start just under the header)
  const inside = () => window.scrollY >= st.start - window.innerHeight * 0.25 && window.scrollY <= st.end + 2;

  const step = (dir) => {
    if (busy || !inside()) return;
    const y = window.scrollY, list = stops();
    const from = Math.max(y, st.start);                                          // above the start: the first flick plays into the story
    const target = dir > 0 ? list.find((p) => p > from + 4) : [...list].reverse().find((p) => p < y - 4 && y > st.start + 4);
    // past either end: let go and carry on scrolling the page normally
    if (target === undefined) { release(dir); return; }
    busy = true;
    const dist = Math.abs(target - y);
    const duration = gsap.utils.clamp(0.9, 3.2, dist / (window.innerHeight * 1.1));
    gsap.to(window, {
      scrollTo: { y: target, autoKill: false }, duration, ease: 'power1.inOut',
      onComplete: () => setTimeout(() => { busy = false; }, 450),              // swallow the trackpad's momentum
    });
  };

  const release = (dir) => {
    busy = true;
    obs.disable();
    const y = dir > 0 ? st.end + Math.round(window.innerHeight * 0.6) : Math.max(0, st.start - Math.round(window.innerHeight * 0.6));
    gsap.to(window, { scrollTo: { y, autoKill: false }, duration: 0.8, ease: 'power2.inOut', onComplete: () => { busy = false; } });
  };

  // wheelSpeed -1 so a wheel down and a finger swipe up are both "up" (= forward)
  const obs = Observer.create({
    target: window, type: 'wheel,touch', wheelSpeed: -1, tolerance: 12, preventDefault: true,
    onUp: () => step(1), onDown: () => step(-1),
  });
  window.addEventListener('keydown', (e) => {
    if (!obs.isEnabled) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
  });
  // take over only while the story is on screen; hand back the page outside it
  const sync = () => { if (busy) return; if (inside()) obs.enable(); else obs.disable(); };
  window.addEventListener('scroll', sync, { passive: true });
  ScrollTrigger.addEventListener('refresh', sync);                           // positions are only known once measured
  sync();
}
