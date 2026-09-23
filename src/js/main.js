/* =====================================================================
   Williams Systems LLC — main.js
   GSAP-driven motion for the home page + nav behaviour.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { initInquiryForm } from './inquiry.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText, DrawSVGPlugin, MotionPathPlugin);

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HIDDEN  = '.header, [data-hero], [data-reveal], [data-stagger] > *, [data-split], .step';

/** SplitText instances we own, so we can revert them cleanly on resize. */
const splits = [];
/** Set by initMobileNav so anchor clicks can close the menu. */
let closeMenu = () => {};

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */
setYear();
initHeader();
initMobileNav();
initAnchors();
initInquiryForm({ reduced: REDUCED });

if (REDUCED) {
  gsap.set(HIDDEN, { visibility: 'visible' });
  $('#intro')?.remove();
} else {
  waitForFonts().then(initMotion);
}

function initMotion() {
  initHero();
  initMarquee();
  initSplitTitles();
  initReveals();
  initProcess();
  initParallax();
  initMagnetic();
  initResplitOnResize();
  ScrollTrigger.refresh();
}

/** Wait for the display/body/mono fonts so SplitText measures real lines. */
function waitForFonts() {
  const loads = ['700 1em Syne', '400 1em Inter', '400 1em "JetBrains Mono"']
    .map((f) => document.fonts.load(f).catch(() => {}));
  const timeout = new Promise((r) => setTimeout(r, 2500));
  return Promise.race([Promise.all(loads).then(() => document.fonts.ready), timeout]);
}

/* ------------------------------------------------------------------ */
/*  Intro splash + hero                                                */
/* ------------------------------------------------------------------ */
function initHero() {
  const intro = $('#intro');
  const showIntro = !!intro && document.documentElement.classList.contains('intro-on');
  try { sessionStorage.setItem('ws-intro', '1'); } catch (e) { /* private mode etc. */ }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (showIntro) {
    document.body.classList.add('no-scroll');
    tl.from('.intro-logo', { yPercent: 110, duration: 0.9, ease: 'power4.out' }, 0.1)
      .from('.intro-text', { yPercent: 110, duration: 0.9, ease: 'power4.out' }, '-=0.7')
      .to('.intro-mark', { autoAlpha: 0, y: -24, duration: 0.35, ease: 'power2.in' }, '+=0.35')
      .to(intro, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.15')
      .add(() => {
        intro.remove();
        document.body.classList.remove('no-scroll');
        ScrollTrigger.refresh();
      })
      .addLabel('hero', '-=0.55');
  } else {
    intro?.remove();
    tl.addLabel('hero', 0);
  }

  // Split the headline into masked lines for the slide-up reveal.
  const title = $('[data-hero="title"]');
  const titleSplit = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'line' });
  splits.push({ el: title, split: titleSplit });

  // clearProps: the header's hide/show uses a CSS transform, so GSAP must not leave one behind.
  tl.from('#header', { y: -20, autoAlpha: 0, duration: 0.8, clearProps: 'transform' }, 'hero')
    .from('[data-hero="eyebrow"]', { y: 14, autoAlpha: 0, duration: 0.6 }, 'hero+=0.1')
    .set(title, { visibility: 'visible' }, 'hero+=0.2')
    .from(titleSplit.lines, { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.1 }, 'hero+=0.2')
    .from('[data-hero="sub"]', { y: 24, autoAlpha: 0, duration: 0.8 }, 'hero+=0.7')
    .set('[data-hero="actions"], [data-hero="meta"]', { visibility: 'visible' }, 'hero+=0.85')
    .from('[data-hero="actions"] > *', { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 'hero+=0.85')
    .from('[data-hero="meta"] > li', { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, 'hero+=1.0')
    .set('[data-hero="visual"]', { visibility: 'visible' }, 'hero+=0.4')
    .add(buildDiagram(), 'hero+=0.4')
    .from('[data-hero="scroll"]', { autoAlpha: 0, duration: 0.8 }, 'hero+=1.7');
}

/** Draws the system diagram: nodes pop in, links draw, packets start flowing. */
function buildDiagram() {
  const svg = $('.sys-diagram');
  const tl = gsap.timeline();
  if (!svg) return tl;

  const nodes   = $$('.node', svg);
  const links   = $$('.link', svg);
  const packets = $$('.packet', svg);
  const rings   = $$('.ring', svg);

  tl.from(nodes, {
      autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%',
      duration: 0.6, ease: 'back.out(1.7)', stagger: 0.07,
    })
    .from(links, { drawSVG: '0%', duration: 0.8, ease: 'power2.inOut', stagger: 0.06 }, '-=0.5')
    .add(() => startPackets(links, packets, rings), '-=0.3');

  return tl;
}

function startPackets(links, packets, rings) {
  packets.forEach((packet, i) => {
    const path = links[i % links.length];
    const reverse = i % 3 === 2; // a few packets travel "back" as responses
    gsap.to(packet, {
      motionPath: {
        path, align: path, alignOrigin: [0.5, 0.5],
        start: reverse ? 1 : 0, end: reverse ? 0 : 1,
      },
      duration: gsap.utils.random(1.6, 2.8),
      ease: 'none',
      repeat: -1,
      repeatDelay: gsap.utils.random(0.3, 1.4),
      delay: i * 0.25,
      // Only show the packet once it is positioned on its path (avoids a dot at the SVG origin).
      onStart: () => gsap.set(packet, { autoAlpha: 1 }),
    });
  });

  rings.forEach((ring, i) => {
    gsap.fromTo(ring,
      { scale: 1, opacity: 0.7, transformOrigin: '50% 50%' },
      { scale: 1.6, opacity: 0, duration: 2.2, ease: 'power1.out', repeat: -1, delay: i * 1.1 },
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Marquee                                                            */
/* ------------------------------------------------------------------ */
function initMarquee() {
  const track = $('#marqueeTrack');
  if (!track) return;
  const tween = gsap.to(track, { xPercent: -50, duration: 30, ease: 'none', repeat: -1 });
  const wrap = track.parentElement;
  wrap.addEventListener('mouseenter', () => gsap.to(tween, { timeScale: 0.2, duration: 0.6 }));
  wrap.addEventListener('mouseleave', () => gsap.to(tween, { timeScale: 1, duration: 0.6 }));
}

/* ------------------------------------------------------------------ */
/*  Scroll reveals                                                     */
/* ------------------------------------------------------------------ */
function initSplitTitles() {
  $$('[data-split]').forEach((el) => {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    gsap.set(el, { visibility: 'visible' });
    const tween = gsap.from(split.lines, {
      yPercent: 110, duration: 1, ease: 'power4.out', stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
    splits.push({ el, split, tween });
  });
}

function initReveals() {
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 36, autoAlpha: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  $$('[data-stagger]').forEach((group) => {
    gsap.from(group.children, {
      y: 30, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Process — pinned horizontal scroll on desktop, stacked on mobile   */
/* ------------------------------------------------------------------ */
function initProcess() {
  const section = $('#process');
  const wrap    = $('#processWrap');
  const track   = $('#processTrack');
  if (!section || !wrap || !track) return;

  const steps = $$('.step', track);
  const bar   = $('.process-progress i', section);
  const mm    = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    const distance = () => Math.max(0, track.offsetWidth - wrap.clientWidth);

    const scrollTween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    if (bar) {
      gsap.to(bar, {
        scaleX: 1, ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: () => '+=' + distance(),
          scrub: true, invalidateOnRefresh: true,
        },
      });
    }

    // Steps already on screen when the section arrives reveal normally;
    // the rest reveal as the track slides them into view.
    const vw = window.innerWidth;
    steps.forEach((step) => {
      const onScreen = step.getBoundingClientRect().left < vw * 0.9;
      gsap.from(step, {
        y: 40, autoAlpha: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: onScreen
          ? { trigger: step, start: 'top 85%', once: true }
          : { trigger: step, containerAnimation: scrollTween, start: 'left 90%', once: true },
      });
    });
  });

  mm.add('(max-width: 899.98px)', () => {
    if (bar) gsap.set(bar, { scaleX: 1 });
    steps.forEach((step) => {
      gsap.from(step, {
        y: 32, autoAlpha: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 88%', once: true },
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Work image parallax                                                */
/* ------------------------------------------------------------------ */
function initParallax() {
  $$('[data-parallax]').forEach((img) => {
    gsap.fromTo(img,
      { yPercent: -7, scale: 1.16 },
      {
        yPercent: 7, scale: 1.16, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Magnetic buttons (pointer devices only)                            */
/* ------------------------------------------------------------------ */
function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------------ */
/*  Re-split safety: on a width change, revert splits to plain text    */
/*  (already-revealed titles stay visible, nothing re-animates).       */
/* ------------------------------------------------------------------ */
function initResplitOnResize() {
  let width = window.innerWidth;
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      splits.forEach(({ el, split, tween }) => {
        tween?.scrollTrigger?.kill();
        tween?.kill();
        split.revert();
        gsap.set(el, { visibility: 'visible' });
      });
      splits.length = 0;
      ScrollTrigger.refresh();
    }, 200);
  });
}

/* ------------------------------------------------------------------ */
/*  Header: frosted when scrolled, hides on scroll-down, shows on up   */
/* ------------------------------------------------------------------ */
function initHeader() {
  const header = $('#header');
  if (!header) return;
  let last = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header.classList.toggle('scrolled', y > 40);
      const goingDown = y > last + 2 && y > 240;
      const goingUp   = y < last - 2;
      if (!document.body.classList.contains('menu-open')) {
        if (goingDown) header.classList.add('hidden');
        else if (goingUp) header.classList.remove('hidden');
      }
      last = y;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Mobile nav                                                         */
/* ------------------------------------------------------------------ */
function initMobileNav() {
  const btn = $('#menuToggle');
  const nav = $('#mobileNav');
  if (!btn || !nav) return;

  const links = $$('a', nav);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .to(nav, { autoAlpha: 1, duration: 0.25 })
    .from(links, { y: 14, autoAlpha: 0, duration: 0.4, stagger: 0.05 }, '<');

  const open = () => {
    document.body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
    tl.play();
  };
  closeMenu = () => {
    if (!document.body.classList.contains('menu-open')) return;
    document.body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
    tl.reverse();
  };

  btn.addEventListener('click', () => {
    document.body.classList.contains('menu-open') ? closeMenu() : open();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

/* ------------------------------------------------------------------ */
/*  Smooth anchor scrolling                                            */
/* ------------------------------------------------------------------ */
function initAnchors() {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      gsap.to(window, {
        scrollTo: { y: target, autoKill: true },
        duration: REDUCED ? 0 : 1.1,
        ease: 'power3.inOut',
      });
      history.replaceState(null, '', id);
    });
  });
}

/* ------------------------------------------------------------------ */
function setYear() {
  const el = $('#year');
  if (el) el.textContent = String(new Date().getFullYear());
}
