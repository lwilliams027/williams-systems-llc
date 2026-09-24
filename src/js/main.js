/* =====================================================================
   Williams Systems LLC — main.js
   GSAP-driven motion for the home page + nav behaviour.
   ===================================================================== */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { initInquiryForm } from './inquiry.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);

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
  const loads = ['700 1em Syne', '400 1em Inter', '400 1em "JetBrains Mono"', 'italic 400 1em "Instrument Serif"']
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
    // Lockup assembles: brackets slide in from the sides, the W rises from
    // below, then WILLIAMS, SYSTEMS LLC, and the two rules draw outward.
    const [lb, w1, w2, rb, word, sub] = $$('.intro-logo path');
    const rules = $$('.intro-logo rect');
    // Blue copies of the L + wordmark, revealed top-to-bottom by a growing clip.
    // Built before the from() tweens so the clones don't inherit their start styles.
    const fillClip = buildIntroFill([w1, word, sub], '#007ACC');
    tl.from(lb, { x: -180, autoAlpha: 0, duration: 0.9, ease: 'power4.out' }, 0.1)
      .from(rb, { x: 180, autoAlpha: 0, duration: 0.9, ease: 'power4.out' }, 0.1)
      .from([w1, w2], { y: 240, autoAlpha: 0, duration: 0.8, ease: 'power4.out', stagger: 0.08 }, 0.3)
      .from(word, { y: 60, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, 0.65)
      .from(sub, { autoAlpha: 0, duration: 0.5 }, 0.9)
      .from(rules[0], { scaleX: 0, transformOrigin: '100% 50%', duration: 0.6, ease: 'power3.out' }, 0.9)
      .from(rules[1], { scaleX: 0, transformOrigin: '0% 50%', duration: 0.6, ease: 'power3.out' }, 0.9)
      // VS Code blue pours into the L (left stroke of the W) and the WILLIAMS /
      // SYSTEMS LLC text, top to bottom, and stays until the splash leaves.
      .to(fillClip, { attr: { height: 1220 }, duration: 1.1, ease: 'power2.inOut' }, 1.4)
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

  // Copy fades up in one stagger (same entrance as the Face & Mane hero),
  // clearProps: the header's hide/show uses a CSS transform, so GSAP must not leave one behind.
  tl.from('#header', { y: -20, autoAlpha: 0, duration: 0.8, clearProps: 'transform' }, 'hero')
    .from('[data-hero]', { y: 32, autoAlpha: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 'hero+=0.15')
    .add(dropScrollCue(), 'hero+=1');

  initHeroShrink();
}

/**
 * Layers colored copies of the given lockup paths over the originals, clipped
 * by a rect that starts at zero height at the top of the logo. Animating the
 * rect's height fills them top to bottom. Returns the rect.
 */
function buildIntroFill(paths, color) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = paths[0].ownerSVGElement;
  const [x, y, w] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const defs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.id = 'introFillClip';
  const rect = document.createElementNS(NS, 'rect');
  Object.entries({ x, y, width: w, height: 0 }).forEach(([k, v]) => rect.setAttribute(k, v));
  clip.append(rect);
  defs.append(clip);
  const layer = document.createElementNS(NS, 'g');
  layer.setAttribute('clip-path', 'url(#introFillClip)');
  layer.setAttribute('fill', color);
  paths.forEach((p) => layer.append(p.cloneNode(false)));
  svg.append(defs, layer);
  return rect;
}

/**
 * Scroll cue: the arrow falls in from above the top of the screen, bounces,
 * settles, then the line keeps drawing down in a loop. Fades out on scroll.
 */
function dropScrollCue() {
  const cue = $('#scrollCue');
  const tl = gsap.timeline();
  if (!cue || getComputedStyle(cue).display === 'none') return tl;

  const arrow = $('.scroll-cue-arrow', cue);
  const rect = arrow.getBoundingClientRect();
  gsap.set(arrow, { opacity: 0, y: -(rect.top + rect.height + 20) });

  tl.to(arrow, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
    .to(arrow, { y: 0, duration: 0.85, ease: 'power2.in' }, 0)   // accelerating fall
    .to(arrow, { y: -14, duration: 0.16, ease: 'sine.out' })      // bounce up
    .to(arrow, { y: 0, duration: 0.5, ease: 'bounce.out' })       // settle
    .add(() => {
      cue.classList.add('looping');
      gsap.to(cue, {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=80', scrub: 0.3 },
      });
    });

  cue.addEventListener('click', () => {
    gsap.to(window, { scrollTo: { y: '#services', autoKill: true }, duration: 1.1, ease: 'power3.inOut' });
  });
  return tl;
}

/**
 * The frame pulls in from both sides and folds up from the bottom as it
 * leaves (uniform scale from the top edge, so the 16:9 picture never
 * distorts), its corners round off, and the copy fades over the first half.
 * Desktop only: on phones the frame is a viewport-height crop.
 * Unlike Face & Mane there is no margin pull: this page has a pinned
 * horizontal section further down, and changing layout height mid-scroll
 * would knock its trigger positions out of place. The fold opens onto ink,
 * which is the page ground anyway.
 */
function initHeroShrink() {
  const frame = $('#heroFrame');
  const copy = $('#heroCopy');
  if (!frame) return;
  const SHRINK_TO = 0.9;
  const RAMP_PX = 350;

  gsap.matchMedia().add('(min-width: 768px)', () => {
    gsap.fromTo(frame,
      { scale: 1, borderRadius: 0, transformOrigin: 'top center' },
      {
        scale: SHRINK_TO, borderRadius: 40, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top top+=' + frame.offsetTop, end: '+=' + RAMP_PX, scrub: 0.25 },
      });
    if (copy) {
      gsap.fromTo(copy, { opacity: 1 }, {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top top+=' + frame.offsetTop, end: '+=' + RAMP_PX / 2, scrub: 0.25 },
      });
    }
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
