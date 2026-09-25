/* =====================================================================
   About page: "Our story", told like the home page journey.

   One pinned stage, one timeline scrubbed by scroll. Five full-screen
   chapters that hand over with 3D flips:
     1 Age 10      a retro computer types HELLO, WORLD; the camera dives into the screen
     2 Self-taught  flip → project cards flip over one by one
     3 Freelance    flip up → a split-flap board rattles every status to LAUNCHED
     4 Medical      flip → a heartbeat line draws itself
     5 Today        flip in → the logo draws, the name decodes, Michigan to the world
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, DrawSVGPlugin);

const section = document.getElementById('story');
if (section) init();

function init() {
  const $ = (s, r = section) => r.querySelector(s);
  const $$ = (s, r = section) => Array.from(r.querySelectorAll(s));
  const scenes = $$('[data-scene]');
  const steps = $$('.sj-progress li');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Final states, used for reduced motion and as the text the animations reveal.
  const lines = $$('.sj-line');
  const flaps = $$('.sj-flap');
  const name = $('.sj-name');
  if (reduced) {
    section.classList.add('is-static');
    lines.forEach((l) => { l.textContent = l.dataset.text; });
    flaps.forEach((f) => { f.textContent = f.dataset.text; });
    return;
  }

  /* ---------------- starting state ---------------- */
  gsap.set(scenes, { autoAlpha: 0, transformPerspective: 1600, transformOrigin: '50% 50%' });
  gsap.set(scenes[0], { autoAlpha: 1 });
  lines.forEach((l) => { l.textContent = ''; });
  gsap.set('.sj-hello', { autoAlpha: 0 });
  gsap.set('.sj-flood', { autoAlpha: 0 });
  gsap.set('.sj-tile-in', { rotateY: 180 });
  flaps.forEach((f) => { f.textContent = f.dataset.text.replace(/[A-Z]/g, ' '); });
  gsap.set('.sj-chips li', { autoAlpha: 0, y: 16 });
  gsap.set('.sj-ecg-line', { drawSVG: '0%' });
  gsap.set('.sj-mark-wrap path', { drawSVG: '0%', fillOpacity: 0 });
  gsap.set(['.sj-pin', '.sj-dot', '.sj-cta'], { autoAlpha: 0, scale: 0.6 });
  gsap.set('.sj-copy > *', { autoAlpha: 0, y: 40 });

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const copyIn = (scene, at) => tl.to($$('.sj-copy > *', scene), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power3.out' }, at);
  const copyOut = (scene, at) => tl.to($$('.sj-copy > *', scene), { autoAlpha: 0, y: -30, duration: 0.2, stagger: 0.03, ease: 'power2.in' }, at);
  // the lit pill follows where the timeline is, in either scroll direction
  const STARTS = [0, 1.9, 3.4, 5.15, 6.8];
  tl.eventCallback('onUpdate', () => {
    let i = 0;
    STARTS.forEach((t, k) => { if (tl.time() >= t) i = k; });
    steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
  });

  /* ---------------- 1 · Age 10 ---------------- */
  const [s1, s2, s3, s4, s5] = scenes;
  // Chapter 1 plays by itself when the page loads; everything after is scrubbed by scroll.
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'none' } }).timeScale(0.6);
  ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => gsap.delayedCall(0.3, () => intro.play()) });
  intro.to($$('.sj-copy > *', s1), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power3.out' }, 0);
  gsap.set('.sj-crt', { rotateX: 14, rotateY: -18, scale: 0.9 });
  intro.to('.sj-crt', { rotateX: 0, rotateY: 0, scale: 1, duration: 0.5, ease: 'power2.out' }, 0);
  lines.forEach((l, k) => {
    const txt = l.dataset.text, p = { n: 0 };
    intro.to(p, { n: txt.length, duration: 0.22, onUpdate: () => { l.textContent = txt.slice(0, Math.round(p.n)); } }, 0.2 + k * 0.24);
  });
  intro.to('.sj-hello', { autoAlpha: 1, duration: 0.08 }, 0.95)
    .fromTo('.sj-hello', { y: 20 }, { y: 0, duration: 0.2 }, 0.95);
  // dive into the screen
  copyOut(s1, 1.3);
  tl.to('.sj-crt', { scale: 7, y: '8%', duration: 0.55, ease: 'power2.in' }, 1.35)
    .to('.sj-flood', { autoAlpha: 1, duration: 0.2 }, 1.65);

  /* ---------------- 2 · Self-taught: the scene flips over ---------------- */
  tl.set(s1, { autoAlpha: 0 }, 1.9)
    .fromTo(s2, { autoAlpha: 1, rotateY: -90 }, { rotateY: 0, duration: 0.4, ease: 'power3.out' }, 1.9);
  copyIn(s2, 2.05);
  tl.to('.sj-tile-in', { rotateY: 0, duration: 0.35, stagger: 0.09, ease: 'back.out(1.4)' }, 2.1);

  /* ---------------- 3 · Freelance: flip up to a split-flap board ---------------- */
  copyOut(s2, 3.0);
  tl.to(s2, { rotateX: 90, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 3.1)
    .fromTo(s3, { autoAlpha: 1, rotateX: -90 }, { rotateX: 0, duration: 0.4, ease: 'power3.out' }, 3.4);
  copyIn(s3, 3.55);
  const rows = $$('.sj-row');
  rows.forEach((row, k) => {
    const at = 3.6 + k * 0.16;
    tl.fromTo(row, { rotateX: -90, autoAlpha: 0 }, { rotateX: 0, autoAlpha: 1, duration: 0.2, ease: 'back.out(1.6)' }, at);
    $$('.sj-flap', row).forEach((f) => {
      tl.to(f, { scrambleText: { text: f.dataset.text, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', speed: 0.6, revealDelay: 0.3 }, duration: 0.35 }, at + 0.05);
    });
    tl.fromTo($('.sj-flap.st', row), { color: '#9CA3AF' }, { color: '#4ADE80', duration: 0.05 }, at + 0.38);
  });

  /* ---------------- 4 · Medical: flip sideways, the heartbeat draws ---------------- */
  copyOut(s3, 4.75);
  tl.to(s3, { rotateY: 90, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 4.85)
    .fromTo(s4, { autoAlpha: 1, rotateY: -90 }, { rotateY: 0, duration: 0.4, ease: 'power3.out' }, 5.15);
  copyIn(s4, 5.3);
  tl.to('.sj-ecg-line', { drawSVG: '100%', duration: 0.7, ease: 'power1.inOut' }, 5.3)
    .fromTo('.sj-bpm', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.2, ease: 'back.out(2)' }, 5.7)
    .to('.sj-chips li', { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.08, ease: 'back.out(2)' }, 5.6);

  /* ---------------- 5 · Today: flip in from below, the logo draws ---------------- */
  copyOut(s4, 6.4);
  tl.to(s4, { rotateX: -90, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 6.5)
    .fromTo(s5, { autoAlpha: 1, rotateX: 90, scale: 0.9 }, { rotateX: 0, scale: 1, duration: 0.45, ease: 'power3.out' }, 6.8);
  copyIn(s5, 6.95);
  tl.to(name, { scrambleText: { text: name.dataset.text, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', speed: 0.8, revealDelay: 0.2 }, duration: 0.45 }, 7.0)
    .to('.sj-mark-wrap path', { drawSVG: '100%', duration: 0.5, stagger: 0.08, ease: 'power1.inOut' }, 7.0)
    .to('.sj-mark-wrap path', { fillOpacity: 1, duration: 0.25, stagger: 0.05 }, 7.45)
    .to('.sj-pin', { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, 7.5)
    .to('.sj-dot', { autoAlpha: 1, scale: 1, duration: 0.15, stagger: 0.05, ease: 'back.out(2)' }, 7.6)
    .to('.sj-cta', { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' }, 7.8)
    .to({}, { duration: 0.6 }, 8.0);                        // hold on the finish

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * 9,
    pin: $('.sj-stage'),
    scrub: 0.7,
    animation: tl,
    // scrolling on before the opening chapter has finished playing: finish it now, so two chapters' words never overlap
    onUpdate: (self) => { if (self.progress > 0 && intro.progress() < 1) intro.progress(1); },
    invalidateOnRefresh: true,
  });
  if (import.meta.env.DEV) window.__story = tl;
}
