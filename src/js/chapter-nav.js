/* =====================================================================
   Clickable chapter pills: every journey's row of pills at the bottom
   (.sj-progress) becomes a set of buttons, each scrolling smoothly to
   its chapter.

   chapterNav(section, tl, timeOf)
     section  the journey's <section>
     tl       its scrubbed timeline (the one its ScrollTrigger drives)
     timeOf   chapter index → the moment in tl to land on (once it has settled)
   ===================================================================== */
export function chapterNav(section, tl, timeOf) {
  const list = section.querySelector('.sj-progress');
  if (!list || !tl.scrollTrigger) return;
  list.removeAttribute('aria-hidden');
  list.setAttribute('aria-label', 'Chapters');
  Array.from(list.children).forEach((li, i) => {
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.title = `Go to ${li.textContent.trim()}`;
    const go = () => {
      const st = tl.scrollTrigger;
      const t = Math.max(0, Math.min(tl.duration(), timeOf(i)));
      const y = i === 0 ? st.start : st.start + (t / tl.duration()) * (st.end - st.start);
      window.scrollTo({ top: Math.round(y), behavior: 'smooth' });
    };
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}
