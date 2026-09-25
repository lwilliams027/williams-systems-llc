/* Pages with their own hand-made journey: put each one's section
   (scripts/journeys/<page>.html) into <page>.html in place of the journey
   that was there, and swap in its own styles and script.
   Usage: node scripts/build-bespoke-pages.cjs [page …]   (no pages = all of them) */
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..') + '/';
// page → the section's id and its own style/script (src/styles/<name>.css, src/js/<name>.js)
const PAGES = {
  'web-apps': { id: 'webapp', name: 'webapp-journey' },
  'saas': { id: 'saasJourney', name: 'saas-journey' },
  'cloud': { id: 'cloudJourney', name: 'cloud-journey' },
  'personalized-ai': { id: 'aiJourney', name: 'ai-journey' },
  'websites': { id: 'websiteJourney', name: 'websites-journey' },
  'mobile-apps': { id: 'mobileJourney', name: 'mobile-journey' },
  'launch-a-new-product': { id: 'launchJourney', name: 'launch-journey' },
  'modernize-an-app': { id: 'modernizeJourney', name: 'modernize-journey' },
  'replace-spreadsheets': { id: 'sheetsJourney', name: 'sheets-journey' },
  'secure-your-software': { id: 'secureJourney', name: 'secure-journey' },
  'move-to-the-cloud': { id: 'migrateJourney', name: 'migrate-journey' },
  'ongoing-support': { id: 'supportJourney', name: 'support-journey' },
  // About us: the journey also takes over from the old hero at the top of the page
  'about': { id: 'aboutJourney', name: 'about-journey', drop: ['<section class="as-hero">'] },
};

const only = process.argv.slice(2);
for (const [page, { id, name, drop = [] }] of Object.entries(PAGES)) {
  if (only.length && !only.includes(page)) continue;
  const file = R + page + '.html';
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const journey = fs.readFileSync(R + `scripts/journeys/${page}.html`, 'utf8').replace(/\r\n/g, '\n').trimEnd();

  // sections this journey replaces outright
  for (const opener of drop) {
    const d = html.indexOf(opener);
    if (d < 0) continue;
    const dEnd = html.indexOf('\n    </section>', d) + '\n    </section>'.length;
    html = html.slice(0, html.lastIndexOf('\n', d) + 1) + html.slice(dEnd).replace(/^\n+/, '');
  }

  // the first journey section on the page, with the comment above it
  // (or the old camera tour, <section class="tour" id="tour">, or the old About story, id="story")
  const a = html.search(new RegExp(`<section class="(sj[^"]*"[^>]*(data-journey|id="${id}"|id="story")|tour" id="tour")`));
  if (a < 0) throw new Error(`no journey section found in ${page}.html`);
  const start = html.lastIndexOf('\n', html.lastIndexOf('<!--', a)) + 1;
  const end = html.indexOf('\n    </section>', a) + '\n    </section>'.length;
  html = html.slice(0, start) + journey + html.slice(end);

  html = html.replace('\n  <link rel="stylesheet" href="/src/styles/flip-journey.css" />', '');
  // the old tours' sample-product styles: not used by these journeys, and their class names collide
  html = html.replace('\n  <link rel="stylesheet" href="/src/styles/product-worlds.css" />', '');
  // the shared journey styles (chapter type, progress pills), after the page's last stylesheet
  if (!html.includes('href="/src/styles/story-journey.css"')) {
    const eol = html.indexOf('\n', html.lastIndexOf('<link rel="stylesheet" href="/src/styles/'));
    html = html.slice(0, eol) + '\n  <link rel="stylesheet" href="/src/styles/story-journey.css" />' + html.slice(eol);
  }
  if (!html.includes(`href="/src/styles/${name}.css"`)) html = html.replace('<link rel="stylesheet" href="/src/styles/story-journey.css" />', `<link rel="stylesheet" href="/src/styles/story-journey.css" />\n  <link rel="stylesheet" href="/src/styles/${name}.css" />`);
  html = html.replace(/<script type="module" src="\/src\/js\/(flip-journey|site-tour|story-journey)\.js"><\/script>/, `<script type="module" src="/src/js/${name}.js"></script>`);
  fs.writeFileSync(file, html);
  console.log(`${page}.html: journey`, html.includes(`id="${id}"`) && html.includes(`/src/js/${name}.js`) ? 'in place' : 'MISSING');
}
