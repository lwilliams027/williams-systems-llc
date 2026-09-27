/* =====================================================================
   Chapter navigation shared by every journey (the pinned, scroll-scrubbed
   stories on the product, Solutions and About pages).

   chapterNav(section, tl, timeOf)
     section  the journey's <section>
     tl       its scrubbed timeline (the one its ScrollTrigger drives)
     timeOf   chapter index → the moment in tl to land on (once it has settled)

   It makes the row of chapter pills (.sj-progress) into buttons that scroll
   smoothly to their chapter, and on touch screens:
     · when a swipe comes to rest between chapters, it settles on the nearest one
     · swiping left or right on the scene goes to the next or previous chapter

   pinLength(chapters) is how far a journey is pinned for: a little shorter
   per chapter on phones, where every chapter is a thumb swipe.
   ===================================================================== */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PLAY, playMode } from './play-mode.js';

// phones show and hide their address bar while you scroll; don't re-measure every pin when that happens
ScrollTrigger.config({ ignoreMobileResize: true });

const touch = () => window.matchMedia('(pointer: coarse)').matches;

export const pinLength = (chapters) => window.innerHeight * (chapters * (touch() ? 1.25 : 1.8) + 0.4);

export function chapterNav(section, tl, timeOf) {
  const list = section.querySelector('.sj-progress');
  if (!list || !tl.scrollTrigger) return;
  const pills = Array.from(list.children);
  const n = pills.length;

  // the scroll position where each chapter has played out
  const spot = (i) => {
    const st = tl.scrollTrigger;
    const t = Math.max(0, Math.min(tl.duration(), timeOf(i)));
    return Math.round(i === 0 ? st.start : st.start + (t / tl.duration()) * (st.end - st.start));
  };
  let landing = 0;                                                     // when we last scrolled on purpose
  let settled = 0;                                                     // the chapter we last came to rest on
  const go = (i) => {
    landing = Date.now();
    settled = Math.max(0, Math.min(n - 1, i));
    window.scrollTo({ top: spot(settled), behavior: 'smooth' });
  };
  const nearest = () => {
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(spot(i) - window.scrollY) < Math.abs(spot(best) - window.scrollY)) best = i;
    return best;
  };

  /* ---------- the pills are buttons ---------- */
  list.removeAttribute('aria-hidden');
  list.setAttribute('aria-label', 'Chapters');
  pills.forEach((li, i) => {
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.title = `Go to ${li.textContent.trim()}`;
    li.addEventListener('click', () => go(i));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); }
    });
  });

  /* ---------- the last pill skips past the story to the rest of the page ---------- */
  const end = document.createElement('li');
  end.className = 'sj-end';
  end.textContent = 'Skip ↓';
  end.setAttribute('role', 'button');
  end.tabIndex = 0;
  end.title = 'Skip past the story';
  const skip = () => {
    landing = Date.now();
    window.scrollTo({ top: Math.round(section.getBoundingClientRect().bottom + window.scrollY), behavior: 'smooth' });
  };
  end.addEventListener('click', skip);
  end.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
  list.appendChild(end);

  // Play mode (?play, for testing): one scroll plays the story to the next chapter
  if (PLAY) { playMode(tl.scrollTrigger, () => pills.map((_, i) => spot(i))); return; }

  if (!touch()) return;

  /* ---------- touch: when a swipe comes to rest, settle on a chapter in the direction it went ---------- */
  // Like turning pages: a swipe forward lands on the next chapter, back on the previous one.
  // (Settling on the *nearest* chapter pulled ordinary thumb swipes back to where they started,
  // since a chapter is longer than a swipe.)
  ScrollTrigger.addEventListener('scrollEnd', () => {
    if (Date.now() - landing < 1200) return;                          // we're already heading somewhere
    const y = window.scrollY;
    if (y <= spot(0) + 2 || y >= spot(n - 1) - 2) { settled = nearest(); return; }   // before the first or after the last: leave it be
    const moved = y - spot(settled);
    let i = settled;
    if (moved > 40) { i = 0; while (i < n - 1 && spot(i) < y) i++; }                // the next chapter ahead
    else if (moved < -40) { i = n - 1; while (i > 0 && spot(i) > y) i--; }          // the one behind
    if (Math.abs(spot(i) - y) > 6) go(i); else settled = i;
  });

  /* ---------- touch: swipe sideways on the scene for the next or previous chapter ---------- */
  const stage = section.querySelector('.sj-stage');
  if (!stage) return;
  let x0 = 0, y0 = 0;
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;   // mostly vertical: that's a normal scroll
    const st = tl.scrollTrigger;
    if (window.scrollY < st.start - 2 || window.scrollY > st.end + 2) return;
    go(nearest() + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
