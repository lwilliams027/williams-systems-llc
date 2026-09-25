/* Web apps page: put the "the page is a web app" journey (scripts/journeys/web-apps.html)
   into web-apps.html in place of the section that was there, with its own styles and script.
   Usage: node scripts/build-webapps-page.cjs */
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..') + '/';
const file = R + 'web-apps.html';
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const journey = fs.readFileSync(R + 'scripts/journeys/web-apps.html', 'utf8').replace(/\r\n/g, '\n').trimEnd();

// the first journey section on the page, with the comment above it
const a = html.search(/<section class="sj[^"]*"[^>]*(data-journey|id="webapp")/);
if (a < 0) throw new Error('no journey section found in web-apps.html');
const start = html.lastIndexOf('\n', html.lastIndexOf('<!--', a)) + 1;
const end = html.indexOf('\n    </section>', a) + '\n    </section>'.length;
html = html.slice(0, start) + journey + html.slice(end);

html = html.replace('\n  <link rel="stylesheet" href="/src/styles/flip-journey.css" />', '');
if (!html.includes('href="/src/styles/webapp-journey.css"')) html = html.replace('<link rel="stylesheet" href="/src/styles/story-journey.css" />', '<link rel="stylesheet" href="/src/styles/story-journey.css" />\n  <link rel="stylesheet" href="/src/styles/webapp-journey.css" />');
html = html.replace('<script type="module" src="/src/js/flip-journey.js"></script>', '<script type="module" src="/src/js/webapp-journey.js"></script>');
fs.writeFileSync(file, html);
console.log('web-apps.html: journey', html.includes('id="webapp"') ? 'in place' : 'MISSING');
