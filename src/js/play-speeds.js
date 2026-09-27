/* =====================================================================
   Play mode (?play): how long each step takes, animation by animation.

   1 = the standard pace. 1.5 = 50% slower. 0.75 = 25% faster.
   Each number is the step that ARRIVES at that point.
   { seconds: 6, ease: 'none' } instead of a number: that step takes exactly
   6 seconds at a steady pace (for steps with a lot in them, like the typing).
   ===================================================================== */

/** An ease made of straight segments: [time, progress] pairs from [0, 0] to [1, 1]. */
function shape(...pts) {
  return (t) => {
    for (let i = 1; i < pts.length; i++) {
      const [t0, p0] = pts[i - 1], [t1, p1] = pts[i];
      if (t <= t1) return p0 + ((t - t0) / (t1 - t0)) * (p1 - p0);
    }
    return 1;
  };
}

/** The home page, in the order you scroll through it. */
export const HOME = {
  fall:        1.15, // the logo falls in → "Software your business runs on."
  whatWeBuild: 1.1, // → "Everything it takes to ship software."
  services1:   1,   // → Front end + Back end & APIs
  services2:   1,   // → SaaS platforms + Mobile apps
  services3:   1,   // → Cloud & DevOps + Personalized AI
  // the editor (project.config.js) zooms in and types → "One team. All custom."
  // ~1.9 s in all: the typing takes ~1 s (zoom and statement ~0.4 s each).
  // (The typing is the middle 38%–67% of this step.)
  oneTeam:     { seconds: 1.9, ease: shape([0, 0], [0.21, 0.38], [0.79, 0.67], [1, 1]) },
  everyPiece:  1,   // the window stack turns → "Every piece. One build."
  website:     1,   // into the website, scroll down it, onto the desk
  lightbulb:   1,   // the bulb drops in → "Make it yours."
  security:    1,   // the bulb falls, sign-in refused, padlock → "Locked down from day one."
  howWeWork:   1,   // through the keyhole → "From first call to launch."
  discover:    1,   // How we work, step 1
  design:      1,   // step 2
  build:       1,   // step 3
  launch:      1,   // step 4
  support:     1,   // step 5
  finale:      1,   // the stars form the logo
};

/**
 * Product, Solutions and About pages: one number per chapter, in order.
 * Pages not listed here use 1 for every chapter.
 */
export const PAGES = {
  // 'websites.html': [1, 1, 1, 1, 1, 1, 1, 1],
};

/** The speed list for the page you're on (chapter pages). */
export const pageSpeeds = () => PAGES[location.pathname.split('/').pop() || 'index.html'] || [];
