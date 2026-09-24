/* =====================================================================
   Finale renderer — a starfield that warps, then swirls in and assembles
   the logo mark, plus the services orbiting it. Scroll-driven: journey.js
   tweens P.warp / P.form / P.orbit / P.orbitIn and calls render().

   The logo is sampled into points by testing a grid against the mark's own
   SVG paths (Path2D + isPointInPath), so the particles land exactly on the
   real mark and the L (second path) comes out blue.
   ===================================================================== */
const MARK_PATHS = [
  'M500 805L500 691.86L243.14 435L500 178.14L500 65L130 435Z',
  'M610 611.86L610 -45L530 35L530 805L858.79 476.21L802.22 419.64Z',
  'M806.72 381.72L863.28 325.15L1150 611.86L1150 -45L1230 35L1230 805Z',
  'M1260 805L1260 691.86L1516.86 435L1260 178.14L1260 65L1630 435Z',
];
const VB = { x: 130, y: -45, w: 1500, h: 850 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function createFinale({ canvas, mark, orbit, stage, scene }) {
  const ctx = canvas.getContext('2d');
  const P = { warp: 0, form: 0, orbit: 0, orbitIn: 0 };
  const orbitItems = [...orbit.children];
  const paths = MARK_PATHS.map((d) => new Path2D(d));
  let W = 0, H = 0, dpr = 1, pts = [], box = { x: 0, y: 0, w: 1, h: 1 };

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);

    // Where the mark sits (layout box, ignoring transforms) and its points.
    const r = mark.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    box = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    const k = r.width / VB.w;
    const step = Math.max(3, r.width / 64);
    const out = [];
    for (let py = step / 2; py < r.height; py += step) {
      for (let px = step / 2; px < r.width; px += step) {
        const ux = VB.x + px / k, uy = VB.y + py / k;
        for (let i = 0; i < paths.length; i++) {
          if (ctx.isPointInPath(paths[i], ux, uy)) { out.push({ tx: px, ty: py, blue: i === 1 }); break; }
        }
      }
    }
    let seed = 5;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const maxR = Math.hypot(W, H) / 2;
    pts = out.map((p) => ({
      ...p,
      a: rand() * Math.PI * 2,                       // the star's direction from the centre
      d: 0.06 + Math.pow(rand(), 0.55) * 0.94,       // and distance (as a fraction of the half-diagonal)
      delay: rand() * 0.35,                          // when it starts flying to the logo
      spin: (rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 3),   // how much it swirls on the way
      size: 0.9 + rand() * 1.5,
      maxR,
    }));
    render();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const visible = parseFloat(getComputedStyle(scene).opacity) > 0 && getComputedStyle(scene).visibility !== 'hidden';
    if (!visible || !pts.length) return;

    const cx = W / 2, cy = H / 2;
    const warpI = Math.sin(Math.PI * clamp01(P.warp));   // 0 → 1 → 0 across the warp
    const f = P.form;
    const logoShow = clamp01((f - 0.84) / 0.16);

    for (const p of pts) {
      const baseR = p.d * p.maxR * (1 + warpI * 0.5);
      const sx = cx + Math.cos(p.a) * baseR, sy = cy + Math.sin(p.a) * baseR;
      if (f <= 0) {
        // Starfield; during the warp each star stretches into a streak along its ray.
        const len = 1.2 + warpI * p.d * p.maxR * 0.5;
        ctx.strokeStyle = p.blue ? `rgba(55,148,255,${0.35 + 0.6 * p.d})` : `rgba(255,255,255,${0.25 + 0.6 * p.d})`;
        ctx.lineWidth = p.size * (0.7 + warpI * 0.6);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(p.a) * len, sy + Math.sin(p.a) * len);
        ctx.stroke();
      } else {
        // Swirl in from the star's position to its spot on the mark.
        const e = easeOutCubic(clamp01((f - p.delay) / 0.62));
        const tx = box.x + p.tx, ty = box.y + p.ty;
        const ang = p.spin * (1 - e);
        const dx = sx - tx, dy = sy - ty, c = Math.cos(ang), s = Math.sin(ang);
        const x = tx + (dx * c - dy * s) * (1 - e);
        const y = ty + (dx * s + dy * c) * (1 - e);
        const alpha = (0.35 + 0.65 * e) * (1 - logoShow * 0.9);
        ctx.fillStyle = p.blue ? `rgba(55,148,255,${alpha})` : `rgba(255,255,255,${alpha})`;
        const sz = p.size * (1 + (1 - e) * 0.8);
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    mark.style.opacity = String(logoShow);

    // Services orbit the mark on a tilted ellipse; the ones behind pass under it.
    const n = orbitItems.length, RX = box.w * 0.95, RY = box.w * 0.26;
    orbitItems.forEach((el, i) => {
      const ang = (i / n) * Math.PI * 2 + P.orbit * Math.PI * 1.6;
      const depth = (Math.sin(ang) + 1) / 2;            // 1 = in front (lower half of the ellipse)
      const x = Math.cos(ang) * RX, y = Math.sin(ang) * RY;
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${0.78 + depth * 0.32})`;
      el.style.opacity = String(P.orbitIn * (0.3 + depth * 0.7));
      el.style.zIndex = depth > 0.5 ? '3' : '1';
    });
  }

  return { P, render, resize };
}
