/* One-time edit: put the flip journeys (scripts/journeys/*.html) into the
   How we work, Client stories, Contact and FAQ generators. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const must = (c, m) => { if (!c) throw new Error(m); };
const JCSS = "'/src/styles/story-journey.css', '/src/styles/flip-journey.css'";

/* ---------------- build-about-section.cjs ---------------- */
let s = read('scripts/build-about-section.cjs');
if (!s.includes("const J = (name)")) {
  // loader: journeys are template literals (they can use ${...})
  s = s.replace("const PHONE = '(947) 267-4788', TEL = '+19472674788';",
    "const PHONE = '(947) 267-4788', TEL = '+19472674788';\n// Flip journeys live in scripts/journeys/*.html and may use ${...} expressions.\nconst J = (name) => new Function(`return \\`${fs.readFileSync(path.join(__dirname, 'journeys', name + '.html'), 'utf8').replace(/\\r\\n/g, '\\n').trimEnd()}\\`;`)();");
  // the old sample-project tour is no longer used
  const a = s.indexOf("/* ------------------------------------------------------------------ keep the sample-project tour for How we work */");
  const b = s.indexOf('/* ------------------------------------------------------------------ about.html */');
  must(a > 0 && b > a, 'tour block');
  s = s.slice(0, a) + s.slice(b);
  // How we work
  const h0 = s.indexOf('${TOUR}');
  const h1 = s.indexOf('    <section class="pg-section">\n      <div class="container">\n        <p class="scene-eyebrow mono">Pricing, ownership, support</p>');
  must(h0 > 0 && h1 > h0, 'how sections');
  s = s.slice(0, h0) + "${J('how')}\n\n" + s.slice(h1);
  s = s.replace("crumb: 'How we work', main, css: ['/src/styles/tour.css', '/src/styles/product-worlds.css', '/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'], js: ['/src/js/site-tour.js'],",
    `crumb: 'How we work', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css', ${JCSS}], js: ['/src/js/flip-journey.js'],`);
  // Client stories
  const c0 = s.indexOf('    <section class="as-hero as-hero-sm">', s.indexOf("class=\"as-page stories-page\""));
  const c1 = s.indexOf('    </section>', c0) + '    </section>'.length;
  must(c0 > 0, 'stories hero');
  s = s.slice(0, c0) + "${J('stories')}" + s.slice(c1);
  s = s.replace("crumb: 'Client stories', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'],",
    `crumb: 'Client stories', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css', ${JCSS}], js: ['/src/js/flip-journey.js'],`);
  // Contact: the journey goes after the booking/message tabs
  const k = "    </section>\n  </main>`;\n  makePage('contact.html', {";
  must(s.includes(k), 'contact end');
  s = s.replace(k, "    </section>\n\n${J('contact')}\n  </main>`;\n  makePage('contact.html', {");
  s = s.replace("crumb: 'Contact', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'], js: ['/src/js/schedule.js', '/src/js/contact.js'],",
    `crumb: 'Contact', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css', ${JCSS}], js: ['/src/js/schedule.js', '/src/js/contact.js', '/src/js/flip-journey.js'],`);
  // makePage strips old page assets: include the journey files
  s = s.replace('(?:ask|tour|product-worlds|about|about-section)\\.css', '(?:ask|tour|product-worlds|about|about-section|story-contact|story-journey|flip-journey)\\.css')
    .replace('(?:ask|site-tour|contact)\\.js', '(?:ask|site-tour|contact|schedule|story-journey|flip-journey)\\.js');
  must(s.split("J('").length === 3 + 1, 'journey count');
  fs.writeFileSync(R + 'scripts/build-about-section.cjs', s);
}

/* ---------------- build-about-faq.cjs (faq.html) ---------------- */
let f = read('scripts/build-about-faq.cjs');
if (!f.includes('journeys')) {
  f = f.replace("  const main = `  <main id=\"main\" class=\"faq-page\">\n",
    "  const JOURNEY = new Function(`return \\`${fs.readFileSync(path.join(__dirname, 'journeys', 'faq.html'), 'utf8').replace(/\\r\\n/g, '\\n').trimEnd()}\\`;`)();\n  const main = `  <main id=\"main\" class=\"faq-page\">\n${JOURNEY}\n\n");
  f = f.replace('<h1 class="ask-title" id="askTitle">Ask us <span>anything.</span></h1>', '<h2 class="ask-title" id="askTitle">Ask us <span>anything.</span></h2>');
  f = f.replace("  f = addAssets(f, ['/src/styles/ask.css'], ['/src/js/ask.js']);",
    "  f = f.replace(/\\n  <link rel=\"stylesheet\" href=\"\\/src\\/styles\\/(?:about-section|story-contact|story-journey|flip-journey)\\.css\" \\/>/g, '')\n    .replace(/\\n  <script type=\"module\" src=\"\\/src\\/js\\/(?:story-journey|flip-journey|contact|schedule)\\.js\"><\\/script>/g, '');\n  f = addAssets(f, ['/src/styles/ask.css', '/src/styles/story-journey.css', '/src/styles/flip-journey.css'], ['/src/js/ask.js', '/src/js/flip-journey.js']);");
  must(f.includes('JOURNEY') && f.includes("'/src/js/flip-journey.js'"), 'faq edit');
  fs.writeFileSync(R + 'scripts/build-about-faq.cjs', f);
}
console.log('generators updated');
