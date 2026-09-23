# Williams Systems LLC — Website

Marketing site for Williams Systems LLC, a full-service software company
(front end, back end, SaaS, mobile, cloud, AI & data).

Built with [Vite](https://vite.dev), vanilla HTML/CSS/JS, and [GSAP](https://gsap.com)
(ScrollTrigger, SplitText, DrawSVG, MotionPath, ScrollTo).

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server hot-reloads on every save.

## Build for production

```bash
npm run build     # outputs static files to dist/
npm run preview   # serves dist/ locally to check the build
```

`dist/` can be dropped on any static host (GitHub Pages, Netlify, Vercel, cPanel).

## Project layout

```
index.html            Home page
src/styles/main.css   All styles (design tokens live at the top in :root)
src/js/main.js        GSAP animations + nav behaviour
public/               Static assets copied as-is (favicon, work images)
vite.config.js        Add new pages to `build.rollupOptions.input`
```

## Pages

- [x] Home (`index.html`)
- [ ] Services
- [ ] Work / case studies
- [ ] About
- [ ] Contact

## Tweaking the look

- Brand colour: change `--accent` in `src/styles/main.css`.
- Fonts: Syne (display), Inter (body), JetBrains Mono (labels) — loaded from Google Fonts in `index.html`.
- The intro splash plays once per browser session. Clear `sessionStorage` (or open a new tab) to see it again.
- Every animation respects `prefers-reduced-motion`.
