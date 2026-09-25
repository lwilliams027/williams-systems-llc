/* Build the FAQ page (faq.html) and rebuild the About page.

   - Collects every question and answer on the site (home FAQ, product pages,
     Solutions pages) into one knowledge base.
   - faq.html: an "Ask us anything" prompt box that answers from that
     knowledge base (src/js/ask.js), plus every Q&A as cards, filterable by topic.
   - about.html: a scroll tour of a sample project run the way we work
     (meet, design, scope, build, launch), what we do, and the prompt box.
   - Points every FAQ link at faq.html, and adds the page to the build,
     the sitemap and llms.txt.
   Usage: node scripts/build-about-faq.cjs   (safe to re-run) */
const fs = require('fs');
const path = require('path');
const { cap, pill } = require('./build-product-pages.cjs');

const R = path.join(__dirname, '..') + '/';
const BASE = 'https://lwilliams027.github.io/williams-systems-llc/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(R + f, s);
const esc = (s) => s.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

/* ------------------------------------------------------------------ 1. knowledge base */
const PRODUCTS = ['websites', 'web-apps', 'saas', 'mobile-apps', 'cloud', 'personalized-ai'];
const SOLUTIONS = ['launch-a-new-product', 'modernize-an-app', 'replace-spreadsheets', 'secure-your-software', 'move-to-the-cloud', 'ongoing-support'];
const KB = [];
const seen = new Set();
const add = (q, a, topic, url) => {
  const key = plain(q).toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  KB.push({ q: plain(q), a: plain(a), topic, url });
};
{
  const home = read('index.html');
  for (const m of home.matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)) add(m[1], m[2], 'General', 'faq.html');
}
for (const slug of [...PRODUCTS, ...SOLUTIONS]) {
  const src = read(`${slug}.html`);
  const topic = plain(src.match(/<p class="scene-eyebrow mono"><a [^>]*>(?:Products|Solutions)<\/a> \/ ([^<]+)<\/p>/)[1]);
  for (const m of src.matchAll(/<span class="qa-q">([\s\S]*?)<\/span>[\s\S]*?<div class="qa-a"><p>([\s\S]*?)<\/p><\/div>/g)) add(m[1], m[2], topic, `${slug}.html`);
}
const TOPICS = [...new Set(KB.map((k) => k.topic))];
console.log('knowledge base:', KB.length, 'answers across', TOPICS.length, 'topics');

/* ------------------------------------------------------------------ 2. shared "ask" block */
const CHIPS = ['How much does it cost?', 'How long does a project take?', 'Do I own the code?', 'Can you fix my existing app?', 'Do you offer support after launch?', 'Is my data private with a personalized AI?'];
const askBlock = (id, heading) => `
    <section class="ask" id="${id}" aria-labelledby="${id}Title">
      <div class="container ask-wrap">
        <div class="ask-head">
          <p class="scene-eyebrow mono">Ask us anything</p>
          ${heading.replace('<h', `<h`).replace('id="X"', `id="${id}Title"`)}
          <p class="pg-p">Type a question the way you'd ask it. Answers come straight from what we tell every client, and if we don't have one written down, you can ask us on a free call.</p>
        </div>
        <div class="ask-box" data-ask>
          <div class="ask-chat" aria-live="polite">
            <div class="ask-msg bot"><i class="ask-av" aria-hidden="true"></i><p>Hi! Ask me about cost, timelines, ownership, support, or any of our products.</p></div>
          </div>
          <form class="ask-form">
            <label class="sr-only" for="${id}Input">Your question</label>
            <input id="${id}Input" type="text" autocomplete="off" placeholder="e.g. How long does a website take?" />
            <button class="btn btn-primary btn-sm" type="submit">Ask</button>
          </form>
          <div class="ask-chips">${CHIPS.map((c) => `<button type="button" class="ask-chip">${c}</button>`).join('')}</div>
        </div>
      </div>
    </section>`;
const kbScript = `<script type="application/json" id="askData">${JSON.stringify(KB).replace(/</g, '\\u003c')}</script>`;

/* ------------------------------------------------------------------ 3. page shell helpers */
const shell = read('about.html');
const withMain = (src, main) => {
  src = src.replace(/\s*<script type="application\/json" id="askData">[\s\S]*?<\/script>/, '');   // re-runs: drop the old copy
  const a = src.indexOf('  <main id="main"'), b = src.indexOf('  </main>') + '  </main>'.length;
  return src.slice(0, a) + main + src.slice(b);
};
const addAssets = (src, css, js) => {
  for (const c of css) if (!src.includes(c)) src = src.replace('<link rel="stylesheet" href="/src/styles/pages.css" />', `<link rel="stylesheet" href="/src/styles/pages.css" />\n  <link rel="stylesheet" href="${c}" />`);
  for (const j of js) if (!src.includes(j)) src = src.replace('<script type="module" src="/src/js/main.js"></script>', `<script type="module" src="/src/js/main.js"></script>\n  <script type="module" src="${j}"></script>`);
  return src;
};

/* ------------------------------------------------------------------ 4. faq.html */
{
  let f = shell;
  const title = 'Questions & Answers | Williams Systems LLC';
  const desc = 'Answers about working with Williams Systems LLC: cost, timelines, code ownership, support, and every product we build. Ask a question and get a straight answer.';
  f = f.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")/g, `$1${desc}$2`)
    .replace(/(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")/g, `$1${title}$2`)
    .split(`${BASE}about.html`).join(`${BASE}faq.html`)
    // FAQ doesn't need About's tour assets
    .replace(/\n  <link rel="stylesheet" href="\/src\/styles\/(?:tour|product-worlds|about)\.css" \/>/g, '')
    .replace(/\n  <script type="module" src="\/src\/js\/site-tour\.js"><\/script>/g, '');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'FAQPage', '@id': BASE + 'faq.html#faq', url: BASE + 'faq.html', mainEntity: KB.map((k) => ({ '@type': 'Question', name: k.q, acceptedAnswer: { '@type': 'Answer', text: k.a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: BASE }, { '@type': 'ListItem', position: 2, name: 'FAQ', item: BASE + 'faq.html' }] },
  ] };
  f = f.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  f = f.replace(/ aria-current="page"/g, '');
  const cards = KB.map((k, i) => `          <details class="faq-item qa-item" data-topic="${esc(k.topic)}"${i === 0 ? ' open' : ''}><summary><span class="qa-q">${esc(k.q)}</span><span class="qa-icon" aria-hidden="true"></span></summary><div class="qa-a"><p>${esc(k.a)}</p>${k.url !== 'faq.html' ? `<a class="qa-more" href="${k.url}">More about ${esc(k.topic)} →</a>` : ''}</div></details>`).join('\n');
  const main = `  <main id="main" class="faq-page">
    <section class="ask ask-hero" id="ask" aria-labelledby="askTitle">
      <div class="container ask-wrap">
        <div class="ask-head">
          <p class="scene-eyebrow mono">Questions &amp; answers</p>
          <h1 class="ask-title" id="askTitle">Ask us <span>anything.</span></h1>
          <p class="pg-p">Type a question the way you'd ask it. Answers come straight from what we tell every client, and if we don't have one written down, you can ask us on a free call.</p>
          <div class="qa-ask"><p>Rather talk it through?</p><a class="btn btn-primary btn-sm" href="contact.html#book">Book a free call</a><a class="qa-mail" href="mailto:lwilliams24270@gmail.com">lwilliams24270@gmail.com</a></div>
        </div>
        <div class="ask-box" data-ask>
          <div class="ask-chat" aria-live="polite">
            <div class="ask-msg bot"><i class="ask-av" aria-hidden="true"></i><p>Hi! Ask me about cost, timelines, ownership, support, or any of our products.</p></div>
          </div>
          <form class="ask-form">
            <label class="sr-only" for="askInput">Your question</label>
            <input id="askInput" type="text" autocomplete="off" placeholder="e.g. How long does a website take?" />
            <button class="btn btn-primary btn-sm" type="submit">Ask</button>
          </form>
          <div class="ask-chips">${CHIPS.map((c) => `<button type="button" class="ask-chip">${c}</button>`).join('')}</div>
        </div>
      </div>
    </section>

    <section class="pg-section faq-all">
      <div class="container">
        <p class="scene-eyebrow mono">Every answer</p>
        <h2 class="pg-h2 qa-title">Browse by <span>topic.</span></h2>
        <div class="faq-filter" role="tablist" aria-label="Filter questions by topic">
          <button type="button" class="faq-tab on" data-topic="all">All</button>${TOPICS.map((t) => `<button type="button" class="faq-tab" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <div class="faq-list qa-list faq-grid">
${cards}
        </div>
      </div>
    </section>
  </main>
  ${kbScript}`;
  f = withMain(f, main);
  f = addAssets(f, ['/src/styles/ask.css'], ['/src/js/ask.js']);
  write('faq.html', f);
  console.log('faq.html written');
}

/* ------------------------------------------------------------------ 5. about.html */
if (false) {   // about.html is now built by scripts/build-about-section.cjs
  let a = read('about.html');
  const H1 = 'A software company <span>built around you.</span>';
  const LEDE = 'Williams Systems LLC designs, builds, and supports websites, web apps, SaaS platforms, mobile apps, and personalized AI for businesses around the world. You work directly with the person building it, from the first call to long after launch.';
  const chromeBar = `<div class="tw-chrome"><span class="tw-dots"><i></i><i></i><i></i></span><span class="tw-url"><svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>projects.williamssystems.dev<b class="tw-live">Live</b></span><span class="tw-sample">Sample project</span></div>`;
  const world = `
            ${chromeBar}
            <div class="pj-top"><span class="pj-logo"><i></i>Project: Lakeside Studio website</span><ol class="pj-steps"><li>Meet</li><li>Design</li><li>Scope</li><li>Build</li><li>Launch</li></ol></div>
            <div class="pj-grid">
              <section class="pj-card pj-meet" data-stop="meet">
                <div class="pj-call"><span class="pj-face a">LS</span><span class="pj-face b">LW</span><em>Discovery call · 28 min</em></div>
                <b class="pj-t">Call notes</b>
                <ul class="pj-notes" data-anim="rise" data-delay="0.08"><li>Goal: more bookings from the website</li><li>Customers mostly on phones</li><li>Must match the new logo</li><li>Launch before the spring season</li></ul>
              </section>
              <section class="pj-card pj-design" data-stop="design">
                <b class="pj-t">Look &amp; feel, agreed together</b>
                <div class="pj-swatches" data-anim="rise" data-delay="0.08"><i style="background:#1F3B4D"></i><i style="background:#E07A5F"></i><i style="background:#F2CC8F"></i><i style="background:#F4F1DE"></i></div>
                <div class="pj-type"><b>Lakeside Studio</b><span>Fraunces headings · Inter body</span></div>
                <div class="pj-mock"><span></span><span></span><span class="short"></span><i></i></div>
                <p class="pj-approve" data-anim="pop" data-delay="0.5">✓ Approved by Lakeside Studio</p>
              </section>
            </div>
            <div class="pj-grid">
              <section class="pj-card pj-scope" data-stop="scope">
                <b class="pj-t">Scope of work</b>
                <ul class="checks big" data-anim="check" data-delay="0.08"><li>6 pages, designed to match your brand</li><li>Online booking with email alerts</li><li>Found on Google (SEO + business listing)</li><li>Hosting and domain set up</li></ul>
                <div class="pj-terms"><span><small>Timeline</small><b>In writing, before we start</b></span><span><small>Price</small><b>One-time or monthly, your choice</b></span></div>
                <span class="pj-sign" data-anim="press" data-delay="0.55">Sign &amp; start</span>
              </section>
              <section class="pj-card pj-build" data-stop="build">
                <b class="pj-t">Build progress</b>
                <div class="pj-prog"><i data-anim="fill" data-delay="0.06" data-dur="0.45"></i></div>
                <div class="pj-week" data-anim="rise" data-delay="0.1"><p><em>Step 1</em>Pages built, preview link sent</p><p><em>Step 2</em>Booking connected, your feedback in</p><p><em>Step 3</em>Final checks on every phone</p></div>
              </section>
            </div>
            <section class="pj-card pj-launch" data-stop="launch">
              <div class="pj-site"><div class="pj-site-top"><b>Lakeside Studio</b><span>Book now</span></div><div class="pj-site-hero"><b>Photography in the light you love.</b><span>Book a session →</span></div></div>
              <div class="pj-own"><b class="pj-t">Handed over</b><ul class="checks" data-anim="check" data-delay="0.1"><li>Launched and tested</li><li>Hosting and domain set up</li><li>Same team on call for support</li></ul></div>
            </section>`;
  const caps = [
    `<li class="tour-cap tour-intro" data-stop="intro"><h2 class="tour-h1" id="howTitle">How we <span>work.</span></h2><p>Here’s a sample project, start to finish: the same steps every client goes through with us.</p><div class="tour-actions"><span class="tour-hint mono">Keep scrolling ↓</span></div></li>`,
    cap('meet', 'Meet', 'We start by listening.', 'A free discovery call about your business, your customers, and what the project needs to do. You talk directly to the person who builds it.', 1.1),
    cap('design', 'Design', 'Your look, agreed together.', 'Colors, fonts, and layout settled with you before anything is built, and revised until it’s right.', 1.1),
    cap('scope', 'Straight answers', 'Everything in writing.', 'A scope of work with every feature, the timeline, and the price: one-time or monthly, whichever fits. No surprises later.', 1.08),
    cap('build', 'Built to last', 'Fast, and done right.', 'Work starts as soon as you sign. You get progress updates as it’s built, on a foundation that’s easy to grow.', 1.1),
    cap('launch', 'Launch and support', 'Live, and looked after.', 'We launch it, hand it over the way your plan calls for, and stay on to support it for as long as you want.', 1.06),
    cap('site', 'End to end', 'Start to finish, <span>one place.</span>', 'Design, build, launch, and support in one place, so nothing gets lost between vendors.', 1.04),
  ];
  const whatCards = [
    ['websites.html', 'Websites', 'Fast, custom sites that win you work'], ['web-apps.html', 'Web apps', 'Dashboards, portals, and internal tools'],
    ['saas.html', 'SaaS platforms', 'Subscriptions and billing built in'], ['mobile-apps.html', 'Mobile apps', 'Apps for iPhone and Android'],
    ['cloud.html', 'Cloud & DevOps', 'Hosting, deployments, and backups'], ['personalized-ai.html', 'Personalized AI', 'AI assistants built around you'],
  ];
  const main = `  <main id="main" class="product-page about-page">
    <section class="about-hero">
      <div class="container about-hero-grid">
        <div>
          <p class="scene-eyebrow mono">About · Who we are</p>
          <h1 class="tour-h1 about-h1" id="pageTitle">${H1}</h1>
          <p class="pg-lede">${LEDE}</p>
          <div class="pg-actions"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><a class="btn btn-ghost" href="#how">See how we work</a></div>
        </div>
        <aside class="founder-card">
          <div class="founder-top"><span class="founder-av" aria-hidden="true">LW</span><div><b>Landon Williams</b><span>Founder</span></div></div>
          <p>Williams Systems LLC is led by its founder, Landon Williams. When you work with us, you talk directly to the person designing and building your project.</p>
          <ul class="founder-facts"><li>Works with clients worldwide, remotely</li><li>Free discovery call to start</li><li>Takes on new builds and existing projects</li><li>Support after launch</li></ul>
        </aside>
      </div>
    </section>

    <section class="pg-section about-what">
      <div class="container">
        <p class="scene-eyebrow mono">What we do</p>
        <h2 class="pg-h2 qa-title">Everything it takes to <span>ship software.</span></h2>
        <div class="about-cards">${whatCards.map(([h, t, d], i) => `<a class="about-card" href="${h}"><i class="ac-${i}"></i><b>${esc(t)}</b><span>${d}</span><em>Take the tour →</em></a>`).join('')}</div>
      </div>
    </section>

    <div id="how"></div>
    <!-- ============ About tour ============
         A sample project (Lakeside Studio, fictional) run the way we work:
         meet, design, scope, build, launch. Generated by scripts/build-about-faq.cjs. -->
    <section class="tour" id="tour" aria-labelledby="howTitle">
      <div class="tour-stage">
        <div class="tour-window" aria-hidden="true">
          <div class="tour-viewport">
          <div class="tw-world w-project" id="tourWorld">${world}
          </div>
          </div>
          <div class="tour-toast tour-pop" data-at="build" data-delay="0.5" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Preview ready</b><span>Lakeside Studio · take a look on your phone</span></div></div>
        </div>
        <div class="tour-captions">
          <p class="scene-eyebrow mono">How we work</p>
          <ol class="tour-caps">
            ${caps.join('\n            ')}
          </ol>
          <ul class="tour-dots" aria-hidden="true">${'<li></li>'.repeat(caps.length)}</ul>
        </div>
      </div>
    </section>

    <section class="pg-section about-promises">
      <div class="container">
        <p class="scene-eyebrow mono">What you can expect</p>
        <h2 class="pg-h2 qa-title">Our <span>promises.</span></h2>
        <div class="promise-grid"><div class="ws-promise win-card"><h3>Straight answers</h3><p>A written scope with every feature, the timeline, and the price, one-time or monthly, before any work begins.</p></div><div class="ws-promise win-card"><h3>Built around you</h3><p>Your brand, your colors, your way of working. We revise with you until it’s right, within the agreed scope.</p></div><div class="ws-promise win-card"><h3>Fast turnaround</h3><p>Work starts as soon as you approve the scope, and you get progress updates while it’s built.</p></div><div class="ws-promise win-card"><h3>Looked after</h3><p>After launch, a monthly support plan or pay per job, whichever suits you.</p></div></div>
      </div>
    </section>
${askBlock('aboutAsk', '<h2 class="ask-title" id="X">Got a question? <span>Just ask.</span></h2>')}
    <p class="ask-all container"><a href="faq.html">See every question and answer →</a></p>
  </main>
  ${kbScript}`;
  a = withMain(a, main);
  a = addAssets(a, ['/src/styles/tour.css', '/src/styles/product-worlds.css', '/src/styles/about.css', '/src/styles/ask.css'], ['/src/js/site-tour.js', '/src/js/ask.js']);
  write('about.html', a);
  console.log('about.html rebuilt');
}

/* ------------------------------------------------------------------ 6. links, build, sitemap, llms */
for (const f of fs.readdirSync(R).filter((x) => x.endsWith('.html') && x !== 'admin.html')) {
  let s = read(f);
  const t = s.replace(/href="\.\/#faq"/g, 'href="faq.html"').replace(/(<a )href="#faq"(>(?:<b>)?FAQ)/g, '$1href="faq.html"$2');
  if (t !== s) { write(f, t); }
}
let vite = read('vite.config.js');
if (!vite.includes("'faq.html'")) vite = vite.replace("        schedule: resolve(import.meta.dirname, 'schedule.html'),", "        schedule: resolve(import.meta.dirname, 'schedule.html'),\n        faq: resolve(import.meta.dirname, 'faq.html'),");
write('vite.config.js', vite);
let sm = read('public/sitemap.xml');
if (!sm.includes('faq.html')) sm = sm.replace('</urlset>', `  <url><loc>${BASE}faq.html</loc><lastmod>2026-09-25</lastmod><priority>0.8</priority></url>\n</urlset>`);
write('public/sitemap.xml', sm);
let llms = read('public/llms.txt');
if (!llms.includes('faq.html')) llms = llms.replace('## Contact', `## Questions and answers\n- [FAQ](${BASE}faq.html): ${KB.length} answers about cost, timelines, ownership, support, and every product\n\n## Contact`);
write('public/llms.txt', llms);
console.log('links, vite, sitemap, llms updated');
