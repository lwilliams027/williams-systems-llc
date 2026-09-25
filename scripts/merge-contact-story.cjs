/* One-time edit to scripts/build-about-section.cjs (then run it):
   - About: the story becomes a scroll tour (age 10 → self-taught → freelance → medical → today)
   - removes the About-section tab bar
   - Contact and Schedule merge: contact.html gets "Book a free call" and
     "Send a message" tabs; schedule.html forwards to contact.html#book
   - every schedule link points to contact.html#book; "Schedule a call" menu items removed
   Usage: node scripts/merge-contact-story.cjs */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(R + f, s);
const G = 'scripts/build-about-section.cjs';
let s = read(G);
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ---------- 1. story tour ---------- */
if (!s.includes('STORY_TOUR')) {
  const a = s.indexOf('    <section class="pg-section as-story">');
  const b = s.indexOf('    </section>', a) + '    </section>'.length;
  must(a > 0, 'story section');
  s = s.slice(0, a) + '${STORY_TOUR}' + s.slice(b);
  const tour = fs.readFileSync(path.join(__dirname, 'story-tour.html'), 'utf8');
  s = s.replace('  const main = `  <main id="main" class="as-page about-page">',
    '  const STORY_TOUR = fs.readFileSync(path.join(__dirname, \'story-tour.html\'), \'utf8\').trimEnd();\n  const main = `  <main id="main" class="as-page about-page">');
  s = s.replace("crumb: 'About', main, css: ['/src/styles/about.css', '/src/styles/about-section.css'],",
    "crumb: 'About', main, css: ['/src/styles/tour.css', '/src/styles/product-worlds.css', '/src/styles/about.css', '/src/styles/about-section.css'], js: ['/src/js/site-tour.js'],");
  must(tour.includes('w-story'), 'story-tour.html');
}

/* ---------- 2. no tab bar ---------- */
s = s.replace(/\n\$\{subnav\('[a-z-]+\.html'\)\}\n/g, '\n');

/* ---------- 3. one call to action button ---------- */
s = s.replace('<div class="pg-actions"><a class="btn btn-primary" href="schedule.html">Book a free call</a><a class="btn btn-ghost" href="contact.html">Contact us</a></div>\n      </div>\n    </section>`;',
  '<div class="pg-actions"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><a class="btn btn-ghost" href="contact.html#message">Send a message</a></div>\n      </div>\n    </section>`;');

/* ---------- 4. contact page: call/text + booking + message ---------- */
{
  const a = s.indexOf('/* ------------------------------------------------------------------ contact.html */');
  const b = s.indexOf('/* ------------------------------------------------------------------ links, build, sitemap, llms */');
  must(a > 0 && b > a, 'contact block');
  s = s.slice(0, a) + fs.readFileSync(path.join(__dirname, 'contact-block.cjs.txt'), 'utf8') + '\n' + s.slice(b);
}

/* ---------- 5. links: schedule -> contact ---------- */
s = s.split("['schedule.html', 'Schedule a call'], ").join('');
s = s.split('href="schedule.html"').join('href="contact.html#book"');   // before adding the menu patterns below
s = s.replace("  ['href=\"#testimonials\">Testimonials</a>', 'href=\"client-stories.html\">Client stories</a>'],\n];",
  "  ['href=\"#testimonials\">Testimonials</a>', 'href=\"client-stories.html\">Client stories</a>'],\n  ['<li><a href=\"schedule.html\"><b>Schedule a call</b><span>Book a free discovery call</span></a></li>', ''],\n  ['<a href=\"schedule.html\">Schedule a call</a>', ''],\n  ['href=\"schedule.html\"', 'href=\"contact.html#book\"'],\n];");
write(G, s);

// the other generators, so a rebuild keeps the new links
for (const f of ['scripts/build-product-pages.cjs', 'scripts/build-solution-pages.cjs', 'scripts/build-about-faq.cjs']) {
  write(f, read(f).split('href="schedule.html"').join('href="contact.html#book"'));
}
console.log('generator updated');
