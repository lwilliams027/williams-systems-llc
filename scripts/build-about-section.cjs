/* Build every page in the About menu:
     about.html          Who we are: the founder's story, what we do, promises
     how-we-work.html    The process: sample-project tour, steps, pricing, ownership, support
     client-stories.html Client stories (placeholders until real testimonials arrive; never invent)
     contact.html        Phone/text and a contact form (replies within 24 hours)
   FAQ (faq.html, scripts/build-about-faq.cjs) and Schedule (schedule.html) already exist.
   Also points the About menu and footer links at these pages, and adds them
   to the build, sitemap and llms.txt. All copy is from facts Landon confirmed.
   Usage: node scripts/build-about-section.cjs   (safe to re-run) */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const BASE = 'https://lwilliams027.github.io/williams-systems-llc/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(R + f, s);
const PHONE = '(947) 267-4788', TEL = '+19472674788';

/* ------------------------------------------------------------------ shell */
const SHELL = read('faq.html');        // clean head/header/footer without tour assets
const makePage = (file, { title, desc, crumb, main, css = [], js = [], ld = [] }) => {
  let s = SHELL;
  s = s.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")/g, `$1${desc}$2`)
    .replace(/(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")/g, `$1${title}$2`)
    .split(`${BASE}faq.html`).join(`${BASE}${file}`);
  const graph = [...ld, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: BASE }, { '@type': 'ListItem', position: 2, name: crumb, item: BASE + file }] }];
  s = s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`);
  // body: new main, and this page's own assets instead of the FAQ's
  const a = s.indexOf('  <main id="main"'), b = s.indexOf('  </main>') + '  </main>'.length;
  s = s.slice(0, a) + main + s.slice(b);
  s = s.replace(/\s*<script type="application\/json" id="askData">[\s\S]*?<\/script>/, '');
  s = s.replace(/\n  <link rel="stylesheet" href="\/src\/styles\/(?:ask|tour|product-worlds|about|about-section)\.css" \/>/g, '')
    .replace(/\n  <script type="module" src="\/src\/js\/(?:ask|site-tour|contact)\.js"><\/script>/g, '');
  for (const c of css) s = s.replace('<link rel="stylesheet" href="/src/styles/pages.css" />', `<link rel="stylesheet" href="/src/styles/pages.css" />\n  <link rel="stylesheet" href="${c}" />`);
  for (const j of [...js].reverse()) s = s.replace('<script type="module" src="/src/js/main.js"></script>', `<script type="module" src="/src/js/main.js"></script>\n  <script type="module" src="${j}"></script>`);
  s = s.replace(/ aria-current="page"/g, '').split(`<a href="${file}">`).join(`<a href="${file}" aria-current="page">`);
  write(file, s);
  console.log(file, 'written');
};
const ORG = { '@type': ['Organization', 'ProfessionalService'], '@id': BASE + '#org', name: 'Williams Systems LLC', url: BASE, telephone: '+1-947-267-4788', founder: { '@type': 'Person', name: 'Landon Williams', jobTitle: 'Founder' }, address: { '@type': 'PostalAddress', addressRegion: 'MI', addressCountry: 'US' }, areaServed: 'Worldwide' };

const cta = (h, p) => `
    <section class="pg-section as-cta">
      <div class="container as-cta-box">
        <h2 class="pg-h2 qa-title">${h}</h2>
        <p class="pg-p">${p}</p>
        <div class="pg-actions"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><a class="btn btn-ghost" href="contact.html#message">Send a message</a></div>
      </div>
    </section>`;
const subnav = (here) => `
    <nav class="as-subnav" aria-label="About section">
      <div class="container">${[['about.html', 'About us'], ['how-we-work.html', 'How we work'], ['client-stories.html', 'Client stories'], ['faq.html', 'FAQ'], ['contact.html', 'Contact us']]
        .map(([h, t]) => `<a href="${h}"${h === here ? ' class="on" aria-current="page"' : ''}>${t}</a>`).join('')}</div>
    </nav>`;

/* ------------------------------------------------------------------ keep the sample-project tour for How we work */
let TOUR = '';
{
  const src = fs.existsSync(R + 'how-we-work.html') && read('how-we-work.html').includes('id="tour"') ? read('how-we-work.html') : read('about.html');
  const a = src.indexOf('    <!-- ============ About tour ============');
  const t = src.indexOf('<section class="tour"', a);
  const e = src.indexOf('\n    </section>', src.indexOf('<div class="tour-captions">', t)) + '\n    </section>'.length;
  if (a < 0 || t < 0) throw new Error('sample-project tour not found');
  TOUR = src.slice(a, e)
    .replace('aria-labelledby="howTitle"', 'aria-labelledby="pageTitle"')
    .replace(/<h2 class="tour-h1" id="howTitle">How we <span>work\.<\/span><\/h2><p>[\s\S]*?<\/p><div class="tour-actions">[\s\S]*?<\/div>/,
      '<h1 class="tour-h1" id="pageTitle">How we <span>work.</span></h1><p>Meet, design, scope, build, launch. Here’s a sample project going through the same steps every client does.</p><div class="tour-actions"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><span class="tour-hint mono">Scroll to follow the project ↓</span></div>')
    .replace('<p class="scene-eyebrow mono">How we work</p>', '<p class="scene-eyebrow mono"><a href="about.html">About</a> / How we work</p>');
  if (!TOUR.includes('<h1 class="tour-h1"')) throw new Error('tour intro not converted');
}

/* ------------------------------------------------------------------ about.html */
{
  const TIMELINE = [
    ['Age 10', 'First lines of code', 'Landon starts building things on a computer and never stops.'],
    ['Self-taught', 'Learning by building', 'Every skill picked up the practical way: by shipping real projects.'],
    ['Freelance', 'Building for clients', 'Websites and apps for businesses, one client at a time.'],
    ['Medical', 'Software for medical companies', 'Development work where getting the details right really matters.'],
    ['Today', 'Williams Systems LLC', 'A full-service software company, based in Michigan and working with clients worldwide.'],
  ];
  const WHAT = [
    ['websites.html', 'Websites', 'Fast, custom sites that win you work'], ['web-apps.html', 'Web apps', 'Dashboards, portals, and internal tools'],
    ['saas.html', 'SaaS platforms', 'Subscriptions and billing built in'], ['mobile-apps.html', 'Mobile apps', 'Apps for iPhone and Android'],
    ['cloud.html', 'Cloud & DevOps', 'Hosting, deployments, and backups'], ['personalized-ai.html', 'Personalized AI', 'AI assistants built around you'],
  ];
  const PROMISES = [
    ['Straight answers', 'A written scope with every feature, the timeline, and the price, one-time or monthly, before any work begins.'],
    ['Built around you', 'Your brand, your colors, your way of working. We revise with you until it’s right, within the agreed scope.'],
    ['Affordable', 'Real, custom software at a price that makes sense for your business, agreed up front.'],
    ['Looked after', 'After launch, a monthly support plan or pay per job, whichever suits you.'],
  ];
  const STORY_TOUR = fs.readFileSync(path.join(__dirname, 'story-tour.html'), 'utf8').trimEnd()
    // the logo mark from the home page, drawn in the Today chapter
    .replace('<!--MARK-->', read('index.html').match(/<svg class="faller-mark"[\s\S]*?<\/svg>/)[0].replace('class="faller-mark"', 'class="sj-mark" aria-hidden="true"'));
  const main = `  <main id="main" class="as-page about-page">
    <section class="as-hero">
      <div class="as-orbs" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="container as-hero-grid">
        <div>
          <p class="scene-eyebrow mono">About · Who we are</p>
          <h1 class="as-h1" id="pageTitle">Built with love, <span>priced to help.</span></h1>
          <p class="pg-lede">Williams Systems LLC designs, builds, and supports websites, web apps, SaaS platforms, mobile apps, and personalized AI. We help people bring their ideas to life with custom software, at a price that makes sense.</p>
          <div class="pg-actions"><a class="btn btn-primary" href="contact.html#book">Book a free call</a><a class="btn btn-ghost" href="how-we-work.html">How we work</a></div>
          <ul class="as-facts"><li><b>Michigan</b><span>Home base</span></li><li><b>Worldwide</b><span>Remote clients</span></li><li><b>24 hours</b><span>Reply to inquiries</span></li></ul>
        </div>
        <aside class="founder-card as-founder">
          <!-- Photo: add public/team/landon.jpg, then replace the initials span below with
               <img class="founder-photo" src="/team/landon.jpg" alt="Landon Williams" width="160" height="160" /> -->
          <div class="as-photo"><span class="founder-av" aria-hidden="true">LW</span></div>
          <b class="as-name">Landon Williams</b>
          <span class="as-role">Founder</span>
          <p>“I’ve loved building since I was ten. I started Williams Systems LLC to help people bring their dreams to life with something I love doing, at a price they can afford.”</p>
          <a class="btn btn-primary btn-sm" href="contact.html#book">Talk with Landon</a>
        </aside>
      </div>
    </section>

${STORY_TOUR}

    <section class="pg-section about-what">
      <div class="container">
        <p class="scene-eyebrow mono">What we do</p>
        <h2 class="pg-h2 qa-title">Everything it takes to <span>ship software.</span></h2>
        <div class="about-cards">${WHAT.map(([h, t, d], i) => `<a class="about-card" href="${h}"><i class="ac-${i}"></i><b>${t.replace('&', '&amp;')}</b><span>${d}</span><em>Take the tour →</em></a>`).join('')}</div>
      </div>
    </section>

    <section class="pg-section about-promises">
      <div class="container">
        <p class="scene-eyebrow mono">What you can expect</p>
        <h2 class="pg-h2 qa-title">Our <span>promises.</span></h2>
        <div class="promise-grid">${PROMISES.map(([t, d]) => `<div class="ws-promise win-card"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </div>
    </section>

    <section class="pg-section as-more">
      <div class="container as-more-grid">
        <a href="how-we-work.html" class="as-more-card"><em>How we work</em><b>Meet. Design. Scope. Built fast.</b><span>Follow a sample project from the first call to launch →</span></a>
        <a href="client-stories.html" class="as-more-card"><em>Client stories</em><b>Hear it from them.</b><span>Stories from the people we build for →</span></a>
        <a href="faq.html" class="as-more-card"><em>FAQ</em><b>Ask us anything.</b><span>Straight answers about cost, timelines, and ownership →</span></a>
      </div>
    </section>
${cta('Have an idea? <span>Let’s build it.</span>', 'Tell us what you have in mind. You’ll hear back within 24 hours.')}
  </main>`;
  makePage('about.html', {
    title: 'About Williams Systems LLC | Founded by Landon Williams',
    desc: 'Williams Systems LLC is a Michigan software company founded by Landon Williams, building websites, apps, SaaS, and personalized AI for clients worldwide at a price that makes sense.',
    crumb: 'About', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css', '/src/styles/story-journey.css'], js: ['/src/js/story-journey.js'],
    ld: [ORG, { '@type': 'AboutPage', '@id': BASE + 'about.html#page', url: BASE + 'about.html', name: 'About Williams Systems LLC', about: { '@id': BASE + '#org' } },
      { '@type': 'Person', name: 'Landon Williams', jobTitle: 'Founder', worksFor: { '@id': BASE + '#org' }, homeLocation: { '@type': 'Place', name: 'Michigan, US' } }],
  });
}

/* ------------------------------------------------------------------ how-we-work.html */
{
  const STEPS = [
    ['Meet', 'A free discovery call about your business, your customers, and what you need. You talk directly to the person who will build it.'],
    ['Design', 'We agree the look together: colors, fonts, layout, and feel. We revise with you until it’s right, within the agreed scope.'],
    ['Scope', 'You get a written scope of work: every feature, the timeline, the price, and the payment terms. Nothing starts until you approve it.'],
    ['Build', 'Work starts right away. You get progress updates and previews while it’s built.'],
    ['Launch & support', 'We launch it, test it, and hand it over the way your plan calls for. Then a monthly support plan or pay per job.'],
  ];
  const main = `  <main id="main" class="as-page how-page product-page">
${TOUR}

    <section class="pg-section">
      <div class="container">
        <p class="scene-eyebrow mono">The steps</p>
        <h2 class="pg-h2 ws-flow-title">Meet. Design. Scope. <span>Built fast.</span></h2>
        <ol class="as-steps">${STEPS.map(([t, d], i) => `<li><span class="as-step-n">${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
      </div>
    </section>

    <section class="pg-section">
      <div class="container">
        <p class="scene-eyebrow mono">Pricing, ownership, support</p>
        <h2 class="pg-h2 qa-title">Two ways to <span>work together.</span></h2>
        <div class="as-plans">
          <div class="as-plan win-card">
            <em>One-time project</em><h3>Pay once, it’s yours.</h3>
            <ul class="as-list"><li>One price for the whole job, agreed in the scope</li><li>The code, domain, and accounts are yours</li><li>Support whenever you need it, paid per job</li></ul>
          </div>
          <div class="as-plan win-card hot">
            <em>Monthly plan</em><h3>We run it for you.</h3>
            <ul class="as-list"><li>A simple monthly price, agreed in the scope</li><li>We host and manage it for you</li><li>Fixes, updates, and new features included</li><li>3-month minimum, then month to month</li></ul>
          </div>
        </div>
        <p class="pg-p as-note">Either way, the price, timeline, and payment terms are written into your scope before any work begins.</p>
      </div>
    </section>
${cta('Ready for <span>step one?</span>', 'Book a free discovery call. It’s the first step, and it’s free.')}
  </main>`;
  makePage('how-we-work.html', {
    title: 'How We Work | Williams Systems LLC',
    desc: 'How a project with Williams Systems LLC runs: a free call, design together, a written scope with the price, a fast build, launch, and support. One-time or monthly.',
    crumb: 'How we work', main, css: ['/src/styles/tour.css', '/src/styles/product-worlds.css', '/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'], js: ['/src/js/site-tour.js'],
    ld: [ORG, { '@type': 'WebPage', '@id': BASE + 'how-we-work.html#page', url: BASE + 'how-we-work.html', name: 'How we work' }],
  });
}

/* ------------------------------------------------------------------ client-stories.html */
{
  const card = (tag) => `<figure class="as-story-card">
            <div class="as-story-media"><span class="as-play" aria-hidden="true"></span><small class="mono">Video or photo coming soon</small></div>
            <figcaption><b>Your story here</b><span>${tag}</span></figcaption>
          </figure>`;
  const main = `  <main id="main" class="as-page stories-page">
    <section class="as-hero as-hero-sm">
      <div class="as-orbs" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="container">
        <p class="scene-eyebrow mono"><a href="about.html">About</a> / Client stories</p>
        <h1 class="as-h1" id="pageTitle">Hear it from <span>them.</span></h1>
        <p class="pg-lede">Real stories from the people we build for, in their own words. We’re collecting them now, so check back soon.</p>
      </div>
    </section>

    <section class="pg-section">
      <div class="container">
        <!-- Placeholders. Replace each card with a real client's video or photo, name, and words,
             only with their permission. Never invent testimonials. -->
        <div class="as-stories">
          ${['Website', 'Web app', 'Mobile app', 'SaaS platform', 'Personalized AI', 'Ongoing support'].map(card).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="pg-section">
      <div class="container as-yours">
        <div>
          <p class="scene-eyebrow mono">Worked with us?</p>
          <h2 class="pg-h2 qa-title">We’d love to share <span>your story.</span></h2>
          <p class="pg-p">A short video, a photo, or a few sentences about what we built together. Text or call us and we’ll make it easy.</p>
        </div>
        <div class="pg-actions"><a class="btn btn-primary" href="sms:${TEL}">Text us</a><a class="btn btn-ghost" href="contact.html">Contact us</a></div>
      </div>
    </section>
${cta('Want to be <span>the next story?</span>', 'Tell us what you want to build. You’ll hear back within 24 hours.')}
  </main>`;
  makePage('client-stories.html', {
    title: 'Client Stories | Williams Systems LLC',
    desc: 'Stories from the people Williams Systems LLC builds for: websites, apps, SaaS, and personalized AI.',
    crumb: 'Client stories', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'],
    ld: [ORG],
  });
}

/* ------------------------------------------------------------------ contact.html (includes booking) */
{
  // The booking form (day and time picker) lives here now; take it from the old
  // Schedule page the first time, then from contact.html on re-runs.
  const from = read('schedule.html').includes('id="schedForm"') ? read('schedule.html') : read('contact.html');
  const fa = from.indexOf('<form class="sched" id="schedForm"');
  const fb = from.indexOf('</div>', from.indexOf('id="schedAgain"')) + '</div>'.length;
  if (fa < 0 || fb < fa) throw new Error('booking form not found');
  const BOOKING = from.slice(fa, fb);
  const NEEDS = ['Website', 'Web app', 'Mobile app', 'SaaS platform', 'Personalized AI', 'Cloud & hosting', 'Fix an existing app', 'Something else'];
  const main = `  <main id="main" class="as-page contact-page">
    <section class="as-hero as-hero-sm">
      <div class="as-orbs" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="container">
        <p class="scene-eyebrow mono"><a href="about.html">About</a> / Contact us</p>
        <div class="as-hero-grid">
          <div>
            <h1 class="as-h1" id="pageTitle">Let’s <span>talk.</span></h1>
            <p class="pg-lede">Book a free call, send a message, or just call or text. We reply within 24 hours.</p>
            <div class="pg-actions"><a class="btn btn-primary" href="tel:${TEL}">Call ${PHONE}</a><a class="btn btn-ghost" href="sms:${TEL}">Send a text</a></div>
            <ul class="as-facts"><li><b>24 hours</b><span>We reply within a day</span></li><li><b>Free</b><span>Discovery call</span></li><li><b>Michigan</b><span>Working worldwide</span></li></ul>
          </div>
          <!-- A working text box: on a phone it opens the texting app to our number with
               the message filled in; on a computer it hands the words to the message form. -->
          <form class="as-text-phone" id="textPhone" data-tel="${TEL}" aria-label="Text Williams Systems LLC">
            <div class="as-tp-top"><span class="as-tp-av" aria-hidden="true">LW</span><div><b>Williams Systems LLC</b><small>${PHONE} · replies within 24 hours</small></div></div>
            <div class="as-tp-thread" aria-live="polite">
              <p class="in">Hi! 👋 Text us about your project, a question, or a good time for a call.</p>
            </div>
            <div class="as-tp-bar">
              <label class="sr-only" for="textBody">Your text message</label>
              <input id="textBody" type="text" autocomplete="off" placeholder="Type your message…" maxlength="600" />
              <button type="submit" aria-label="Send text"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z" fill="currentColor"/></svg></button>
            </div>
            <small class="as-tp-note">Texts go straight to Landon</small>
          </form>
        </div>
      </div>
    </section>

    <section class="pg-section as-reach">
      <div class="container">
        <div class="as-tabs" role="tablist" aria-label="How would you like to reach us?">
          <button type="button" role="tab" class="as-tab on" id="tabBook" aria-controls="book" aria-selected="true">Book a free call</button>
          <button type="button" role="tab" class="as-tab" id="tabMessage" aria-controls="message" aria-selected="false">Send a message</button>
        </div>
        <div class="as-panel win-card" id="book" role="tabpanel" aria-labelledby="tabBook">
          <h2 class="as-form-title">Pick a time for a free call</h2>
          <p class="as-panel-sub">Choose the kind of call, a day, and a time. We’ll confirm within 24 hours.</p>
          ${BOOKING}
        </div>
        <div class="as-panel win-card" id="message" role="tabpanel" aria-labelledby="tabMessage" hidden>
          <form class="as-form" id="contactForm" novalidate>
            <h2 class="as-form-title">Send a message</h2>
            <div class="as-row2">
              <label>Your name<input name="name" autocomplete="name" required /></label>
              <label>Email<input name="email" type="email" autocomplete="email" required /></label>
            </div>
            <label>Phone <small>(optional)</small><input name="phone" type="tel" autocomplete="tel" /></label>
            <fieldset class="as-needs"><legend>What do you need?</legend>${NEEDS.map((n) => `<label class="as-need"><input type="checkbox" name="needs" value="${n}" /><span>${n.replace('&', '&amp;')}</span></label>`).join('')}</fieldset>
            <label>Tell us about it<textarea name="message" rows="5" placeholder="What are you hoping to build?"></textarea></label>
            <p class="as-error" id="contactError" role="alert" hidden></p>
            <button class="btn btn-primary" type="submit">Send message</button>
            <div class="as-sent" id="contactSent" hidden tabindex="-1"><b>Almost there.</b><p>Your email app just opened with your message. Hit send, and we’ll reply within 24 hours.</p></div>
          </form>
        </div>
      </div>
    </section>
  </main>`;
  makePage('contact.html', {
    title: 'Contact Williams Systems LLC | Book a Free Call or Send a Message',
    desc: `Contact Williams Systems LLC: book a free discovery call, send a message, or call or text ${PHONE}. We reply within 24 hours.`,
    crumb: 'Contact', main, css: ['/src/styles/about.css', '/src/styles/about-section.css', '/src/styles/story-contact.css'], js: ['/src/js/schedule.js', '/src/js/contact.js'],
    ld: [ORG, { '@type': 'ContactPage', '@id': BASE + 'contact.html#page', url: BASE + 'contact.html', name: 'Contact Williams Systems LLC' }],
  });

  // The old Schedule page now forwards to the booking tab.
  write('schedule.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Book a Free Call | Williams Systems LLC</title>
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${BASE}contact.html" />
  <meta http-equiv="refresh" content="0; url=contact.html#book" />
  <script>location.replace('contact.html#book');</script>
</head>
<body>
  <p>Booking has moved to our <a href="contact.html#book">contact page</a>.</p>
</body>
</html>
`);
  let sm = read('public/sitemap.xml');
  sm = sm.replace(/\s*<url><loc>[^<]*schedule\.html<\/loc>[^\n]*<\/url>/, '');
  write('public/sitemap.xml', sm);
}

/* ------------------------------------------------------------------ links, build, sitemap, llms */
const LINKS = [
  ['href="./#process"><b>How we work</b>', 'href="how-we-work.html"><b>How we work</b>'],
  ['href="./#testimonials"><b>Client stories</b>', 'href="client-stories.html"><b>Client stories</b>'],
  ['href="#contact"><b>Contact us</b>', 'href="contact.html"><b>Contact us</b>'],
  ['href="./#process">How we work</a>', 'href="how-we-work.html">How we work</a>'],
  ['href="./#testimonials">Client stories</a>', 'href="client-stories.html">Client stories</a>'],
  ['href="#contact">Contact us</a>', 'href="contact.html">Contact us</a>'],
  ['href="./#process">Process</a>', 'href="how-we-work.html">How we work</a>'],
  ['href="#process">Process</a>', 'href="how-we-work.html">How we work</a>'],
  ['href="./#testimonials">Testimonials</a>', 'href="client-stories.html">Client stories</a>'],
  ['href="#testimonials">Testimonials</a>', 'href="client-stories.html">Client stories</a>'],
  ['<li><a href="schedule.html"><b>Schedule a call</b><span>Book a free discovery call</span></a></li>', ''],
  ['<a href="schedule.html">Schedule a call</a>', ''],
  ['href="schedule.html"', 'href="contact.html#book"'],
];
for (const f of fs.readdirSync(R).filter((x) => x.endsWith('.html') && x !== 'admin.html')) {
  let s = read(f); const b = s;
  for (const [a, c] of LINKS) s = s.split(a).join(c);
  if (s !== b) write(f, s);
}
let vite = read('vite.config.js');
for (const [k, f] of [['howWeWork', 'how-we-work.html'], ['clientStories', 'client-stories.html'], ['contact', 'contact.html']]) {
  if (!vite.includes(`'${f}'`)) vite = vite.replace("        faq: resolve(import.meta.dirname, 'faq.html'),", `        faq: resolve(import.meta.dirname, 'faq.html'),\n        ${k}: resolve(import.meta.dirname, '${f}'),`);
}
write('vite.config.js', vite);
let sm = read('public/sitemap.xml');
for (const f of ['how-we-work.html', 'client-stories.html', 'contact.html']) if (!sm.includes(f)) sm = sm.replace('</urlset>', `  <url><loc>${BASE}${f}</loc><lastmod>2026-09-25</lastmod><priority>0.7</priority></url>\n</urlset>`);
write('public/sitemap.xml', sm);
let llms = read('public/llms.txt');
if (!llms.includes('how-we-work.html')) llms = llms.replace('## Contact', `## About\n- [About](${BASE}about.html): founded by Landon Williams; based in Michigan; works with clients worldwide, remotely\n- [How we work](${BASE}how-we-work.html): free call, design together, written scope with price (one-time or monthly), fast build, launch, support\n- [Contact](${BASE}contact.html): call or text ${PHONE}; replies within 24 hours\n\n## Contact`);
write('public/llms.txt', llms);
console.log('menus, vite, sitemap, llms updated');
