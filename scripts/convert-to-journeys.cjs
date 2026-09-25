/* Turn the camera tours on the product and Solutions pages into flip journeys
   (the home-page style used across the About section), each page keeping its
   own sample product so every page has its own look.

   Websites and Mobile apps keep their tours. Needs the dev server running
   (npm run dev) and playwright-core with Microsoft Edge.
   Usage: node scripts/convert-to-journeys.cjs
   Run it last: after build-product-pages.cjs / build-solution-pages.cjs. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const R = path.join(__dirname, '..') + '/';
const DEV = 'http://127.0.0.1:5173/';
// page → [signature style (STYLES in src/js/flip-journey.js), glow tint, the move for each change of
// chapter (STYLES/MOVES; its own order on every page), finale board label]
const PAGES = {
  'web-apps':             ['cube', '99,102,241', 'cube dive flipX shutter elevator tumble cube', 'YOUR WEB APP'],
  'saas':                 ['deck', '16,185,129', 'deck flipY elevator dive tumble shutter deck', 'YOUR SAAS'],
  'cloud':                ['cloud', '56,189,248', 'cloud elevator dive flipY shutter cloud', 'YOUR CLOUD SETUP'],
  'personalized-ai':      ['scan', '160,107,255', 'scan dive tumble flipY elevator shutter scan', 'YOUR AI ASSISTANT'],
  'launch-a-new-product': ['launch', '76,175,80', 'launch dive shutter flipX launch', 'YOUR PRODUCT'],
  'modernize-an-app':     ['wipe', '236,72,153', 'wipe flipX dive tumble elevator wipe', 'YOUR APP'],
  'replace-spreadsheets': ['fold', '20,184,166', 'fold shutter flipY dive elevator fold', 'YOUR NEW TOOL'],
  'secure-your-software': ['iris', '239,68,68', 'iris shutter flipX dive tumble iris', 'YOUR SOFTWARE'],
  'move-to-the-cloud':    ['migrate', '14,165,233', 'migrate flipY dive elevator shutter migrate', 'YOUR SERVERS'],
  'ongoing-support':      ['swing', '59,130,246', 'swing dive flipX elevator tumble swing', 'YOUR SOFTWARE'],
};

/* Runs in the page: read the pristine source (not the animated DOM), measure the
   real layout, and return what each chapter needs. */
function extract() {
  return fetch(location.href).then((r) => r.text()).then((html) => {
    const src = new DOMParser().parseFromString(html, 'text/html');
    const tour = src.querySelector('#tour');
    const world = tour.querySelector('#tourWorld');
    const liveWorld = document.querySelector('#tourWorld');
    const worldClass = [...world.classList].filter((c) => c !== 'tw-world').join(' ');
    const size = (sel) => { const el = liveWorld.querySelector(sel); return el ? { w: el.offsetWidth, h: el.offsetHeight } : null; };
    // demos: tour vocabulary → journey vocabulary
    const convert = (root) => {
      root.querySelectorAll('[data-anim]').forEach((el) => {
        const k = el.dataset.anim;
        if (k === 'load' || k === 'focus') { el.removeAttribute('data-anim'); return; }
        el.setAttribute('data-sj', k);
        el.removeAttribute('data-anim');
        if (el.dataset.delay) { el.setAttribute('data-d', String(Math.max(0, parseFloat(el.dataset.delay)))); el.removeAttribute('data-delay'); }
        if (el.dataset.fill) { el.setAttribute('data-text', el.dataset.fill); el.removeAttribute('data-fill'); }
        el.removeAttribute('data-at');
      });
      root.querySelectorAll('[data-stop]').forEach((el) => el.removeAttribute('data-stop'));
      root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      return root;
    };
    // overview: the whole product, finished (no demos)
    const over = world.cloneNode(true);
    over.querySelectorAll('[data-fill]').forEach((el) => { el.textContent = el.dataset.fill; });
    over.querySelectorAll('[data-anim],[data-stop],[data-delay],[data-fill],[data-at]').forEach((el) => ['data-anim', 'data-stop', 'data-delay', 'data-fill', 'data-at'].forEach((a) => el.removeAttribute(a)));
    over.removeAttribute('id');
    const overview = { html: over.innerHTML, w: liveWorld.offsetWidth, h: liveWorld.offsetHeight };

    const caps = [...tour.querySelectorAll('.tour-cap')];
    const intro = caps.find((c) => c.dataset.stop === 'intro');
    const chapters = caps.filter((c) => !['intro', 'site'].includes(c.dataset.stop)).map((c) => {
      const stop = c.dataset.stop;
      const el = world.querySelector(`[data-stop="${stop}"]`);
      const frag = convert(el.cloneNode(true));
      // notifications that belonged to this stop
      const pops = [...tour.querySelectorAll(`.tour-pop[data-at="${stop}"]`)].map((p) => {
        const q = p.cloneNode(true);
        q.className = 'fj-toast'; q.removeAttribute('data-at'); q.removeAttribute('data-delay');
        q.setAttribute('data-sj', 'pop'); q.setAttribute('data-d', '0.5');
        return q.outerHTML;
      }).join('');
      return {
        k: c.querySelector('.tour-cap-k')?.innerHTML || '', h: c.querySelector('h3')?.innerHTML || '', p: c.querySelector('p:not(.tour-cap-k)')?.innerHTML || '',
        frag: frag.outerHTML, size: size(`[data-stop="${stop}"]`), pops,
      };
    });
    const site = caps.find((c) => c.dataset.stop === 'site');
    return {
      worldClass, overview, chapters,
      crumb: tour.querySelector('.tour-captions > .scene-eyebrow')?.innerHTML || '',
      intro: { h1: intro.querySelector('h1').innerHTML, p: intro.querySelector('p').innerHTML },
      site: site ? { k: site.querySelector('.tour-cap-k')?.innerHTML, h: site.querySelector('h3')?.innerHTML, p: site.querySelector('p:not(.tour-cap-k)')?.innerHTML } : null,
      product: (tour.querySelector('.tour-captions > .scene-eyebrow')?.textContent || '').split('/').pop().trim(),
    };
  });
}

const frag = (worldClass, html, s, extra = '') => `<div class="fj-fit"><div class="tw-world ${worldClass} fj-piece" style="width:${s.w}px">${html}</div></div>${extra}`;

function journey(slug, d, [style, tint, seq, label]) {
  const scenes = [];
  scenes.push(`        <div class="sj-scene" data-scene data-label="Overview">
          <div class="sj-copy">
            <p class="sj-k mono">${d.crumb}</p>
            <h1 class="sj-h" id="pageTitle">${d.intro.h1}</h1>
            <p class="sj-p">${d.intro.p}</p>
            <div class="sj-cta"><a class="btn btn-primary" href="contact.html#book">Get started</a><span class="tour-hint mono">Scroll to take the tour ↓</span></div>
          </div>
          <div class="sj-visual" aria-hidden="true">${frag(d.worldClass + ' fj-over', d.overview.html, d.overview)}</div>
        </div>`);
  d.chapters.forEach((c, i) => {
    scenes.push(`        <div class="sj-scene" data-scene data-label="${c.k.replace(/<[^>]+>/g, '')}">
          <div class="sj-copy">
            <p class="sj-k mono">${c.k}</p>
            <h2 class="sj-h">${c.h}</h2>
            <p class="sj-p">${c.p}</p>
          </div>
          <div class="sj-visual fj-stage" aria-hidden="true">${frag(d.worldClass, c.frag, c.size || { w: 900 }, c.pops)}</div>
        </div>`);
  });
  if (d.site) {
    scenes.push(`        <div class="sj-scene" data-scene data-label="${(d.site.k || 'Live').replace(/<[^>]+>/g, '')}" data-flip="zoom">
          <div class="sj-copy">
            <p class="sj-k mono">${d.site.k}</p>
            <h2 class="sj-h">${d.site.h}</h2>
            <p class="sj-p">${d.site.p}</p>
            <div class="sj-cta"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><a class="btn btn-ghost" href="contact.html#message">Send a message</a></div>
          </div>
          <div class="sj-visual" aria-hidden="true">
            <div class="sj-board fj-status"><div class="sj-board-head"><span>Project</span><span>Status</span></div><div class="sj-row"><span class="sj-flap">${label}</span><span class="sj-flap st" data-sj="flap" data-color="#4ADE80" data-text="LIVE"></span></div></div>
          </div>
        </div>`);
  }
  return `    <!-- ============ ${d.product} journey ============
         The page's sample product, one chapter at a time, flipping from one to the
         next (src/js/flip-journey.js). Generated by scripts/convert-to-journeys.cjs. -->
    <section class="sj sj-product" data-journey data-style="${style}" data-seq="${seq}" style="--sj-tint:${tint}" aria-labelledby="pageTitle">
      <div class="sj-stage">
        <div class="sj-bg" aria-hidden="true"><i class="sj-grid"></i><i class="sj-glow"></i></div>
${scenes.join('\n\n')}

        <ol class="sj-progress" aria-hidden="true"></ol>
      </div>
    </section>`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [slug, style] of Object.entries(PAGES)) {
    const file = R + slug + '.html';
    let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (!html.includes('id="tour"')) { console.log(slug, 'already converted, skipped'); continue; }
    await page.goto(DEV + slug + '.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const d = await page.evaluate(extract);
    const a = html.indexOf('<section class="tour" id="tour"');
    const start = html.lastIndexOf('\n', html.lastIndexOf('<!--', a)) + 1;
    const end = html.indexOf('\n    </section>', html.indexOf('<div class="tour-captions">', a)) + '\n    </section>'.length;
    html = html.slice(0, start) + journey(slug, d, style) + html.slice(end);
    html = html.replace('\n  <link rel="stylesheet" href="/src/styles/tour.css" />', '')
      .replace('<link rel="stylesheet" href="/src/styles/product-worlds.css" />', '<link rel="stylesheet" href="/src/styles/product-worlds.css" />\n  <link rel="stylesheet" href="/src/styles/story-journey.css" />\n  <link rel="stylesheet" href="/src/styles/flip-journey.css" />')
      .replace('<script type="module" src="/src/js/site-tour.js"></script>', '<script type="module" src="/src/js/flip-journey.js"></script>');
    fs.writeFileSync(file, html);
    console.log(slug, '→', d.chapters.length + 2, 'chapters');
  }
  await browser.close();
})();
