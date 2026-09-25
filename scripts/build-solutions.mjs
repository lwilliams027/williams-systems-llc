/**
 * Build the Solutions pages, and point every menu at them.
 *
 * The Solutions menu used to send people to the booking page or to an anchor
 * on the home page. Each entry now has a page of its own, built from the same
 * shell as the product pages so the header, footer, and styling stay identical.
 *
 *   node scripts/build-solutions.mjs
 *
 * Re-run it after editing the content below; it rewrites the six pages and the
 * Solutions menu in every .html file at the project root.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lwilliams027.github.io/williams-systems-llc';
const SHELL = 'cloud.html'; // an existing page to take the header and footer from

/* ── What each page says ──────────────────────────────────────────────────
   Written to match how the company actually works: a call, a design
   conversation, a written scope, then the build. Pricing is a one-time price
   for the job or a monthly plan, whichever fits — never only one of those. */

const SOLUTIONS = [
  {
    slug: 'launch-a-new-product',
    nav: 'Launch a new product',
    navBlurb: 'From idea to something real people use',
    title: 'Launch a new product',
    metaTitle: 'Launch a New Product | Williams Systems LLC',
    headline: ['You have the idea.', 'We build the thing.'],
    lede: 'Go from a sketch on a napkin to software your customers can sign up for. One team designs it, builds it, ships it, and keeps it running.',
    description: 'Take a new software product from idea to launch with one team: design, build, launch, and support, with a written scope and price before any work starts.',
    getEyebrow: 'What you get',
    getTitle: 'Everything a first version needs.',
    features: [
      ['A design you approve first', 'Real screens you can click through before a line of code is written, so nothing is a surprise.'],
      ['The product itself', 'Built custom for what you are actually doing, not bent out of a template.'],
      ['Accounts and sign-in', 'Users, passwords, permissions, and the boring security parts done properly.'],
      ['Payments, if you sell', 'Checkout, subscriptions, and receipts wired up and tested.'],
      ['Somewhere to run it', 'Hosting, domains, and backups set up in accounts you own.'],
      ['A way to see how it is doing', 'Simple analytics and alerts, so you know what people actually use.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For the first version, done right.',
    forLede: 'Most first versions fail slowly: built from a template, held together by three vendors, impossible to change. We build yours to be changed.',
    forCards: [
      ['Founders', 'You have customers waiting and need something real in front of them.'],
      ['Established businesses', 'A new product line that should not be bolted onto the old system.'],
      ['Teams replacing a tool', 'The software you rent does not fit, so you are building your own.'],
    ],
    faq: [
      ['How small can a first version be?', 'Smaller than you think. We look for the shortest path to something people can genuinely use, then add from there once it is in their hands.'],
      ['How long does it take?', 'We move fast and we tell you the timeline in writing before starting. Small products ship in weeks, not quarters.'],
      ['What does it cost?', 'Either a one-time price for the job or a monthly plan, depending on what the work looks like. Whichever it is, it is agreed in the scope before anything begins.'],
      ['Who owns what we build?', 'You do. The code, the accounts, the domain, all of it, from day one.'],
    ],
  },
  {
    slug: 'modernize-an-app',
    nav: 'Modernize an existing app',
    navBlurb: 'Fix, speed up, and future-proof what you have',
    title: 'Modernize an existing app',
    metaTitle: 'Modernize an Existing App | Williams Systems LLC',
    headline: ['Software you already have,', 'worth keeping.'],
    lede: 'Slow, fragile, or written by someone who left years ago. We take it on, make it solid, and hand it back faster than it has been in years.',
    description: 'Review, repair, and speed up software you already own: fix what is broken, remove the risk, and make it something a team can safely change again.',
    getEyebrow: 'What you get',
    getTitle: 'A straight answer, then the fix.',
    features: [
      ['An honest review', 'What is good, what is risky, and what it would take to fix, in plain English.'],
      ['Speed', 'The slow pages found and made fast, with the reasons written down.'],
      ['Fewer things breaking', 'Tests around the parts that matter, so a change stops causing three new problems.'],
      ['Up-to-date foundations', 'Old libraries and abandoned tools replaced with ones that are still maintained.'],
      ['Security caught up', 'Known holes closed, secrets moved out of the code, access tightened.'],
      ['Documentation', 'How it works and how to run it, so you are never held hostage by one person.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For software that works, barely.',
    forLede: 'You do not need to throw it away. Most of the time the bones are fine and the last few years of shortcuts are the problem.',
    forCards: [
      ['Inherited code', 'The person who built it is gone and nobody wants to touch it.'],
      ['It got slow', 'It was fine at a hundred users and is painful at a thousand.'],
      ['It cannot change', 'Every new feature takes months, and something else always breaks.'],
    ],
    faq: [
      ['Do we have to rewrite it?', 'Usually not. A rewrite is the expensive answer and rarely the right one. We tell you honestly when it is.'],
      ['Can you work with our current developers?', 'Yes. We can review, advise, and work alongside them, or take it over completely.'],
      ['Will the site go down while you work?', 'No. Changes go out the same safe way every time, and we test before anything reaches your users.'],
      ['What does it cost?', 'A review has a one-time price. The work after it is either a one-time price or a monthly plan, whichever fits, agreed in writing first.'],
    ],
  },
  {
    slug: 'replace-spreadsheets',
    nav: 'Replace spreadsheets',
    navBlurb: 'A real tool shaped like how you work',
    title: 'Replace spreadsheets',
    metaTitle: 'Replace Spreadsheets With Custom Software | Williams Systems LLC',
    headline: ['The spreadsheet got you here.', 'It will not get you further.'],
    lede: 'Custom software built around the way you already work, so the thing everyone depends on stops being a file somebody could delete.',
    description: 'Turn the spreadsheet your business runs on into real software: shaped around your process, safe from accidents, and usable by the whole team at once.',
    getEyebrow: 'What you get',
    getTitle: 'Your process, made into software.',
    features: [
      ['Built around your process', 'We start from how you work now, not from what a template can do.'],
      ['Everyone at once', 'Several people working at the same time without a file called final-v3-REAL.'],
      ['Rules that hold', 'The things that must be true stay true, however fast someone is typing.'],
      ['Who did what', 'A record of every change, so a wrong number has an explanation.'],
      ['Permissions', 'People see what they should see and nothing else.'],
      ['Reports without the rebuild', 'The numbers you check every week, ready, instead of assembled by hand.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For the file the business depends on.',
    forLede: 'Every growing company has one: a workbook with twelve tabs, three formulas nobody understands, and one person who knows how it works.',
    forCards: [
      ['Operations', 'Jobs, schedules, and stock tracked by hand across tabs.'],
      ['Finance and admin', 'Numbers copied between files and rekeyed into something else.'],
      ['Field and service teams', 'Paper or a phone photo, retyped into the sheet that evening.'],
    ],
    faq: [
      ['Do we lose the data already in our spreadsheets?', 'No. We bring it across and check it with you before switching over.'],
      ['Can we still export to a spreadsheet?', 'Yes. Plenty of people still want the numbers in a sheet, and that keeps working.'],
      ['How long before we can stop using the old file?', 'Usually weeks. We get the core of it working first so you can move off the sheet early.'],
      ['What does it cost?', 'A one-time price for the build, or a monthly plan if you would rather spread it and keep us on for changes. Agreed up front either way.'],
    ],
  },
  {
    slug: 'secure-your-software',
    nav: 'Secure your software',
    navBlurb: 'Sign-in, permissions, and hardening',
    title: 'Secure your software',
    metaTitle: 'Secure Your Software | Williams Systems LLC',
    headline: ['The part nobody sees,', 'until it goes wrong.'],
    lede: 'Sign-in done properly, permissions that hold, secrets out of the code, and the known holes closed, on software we built or software you already have.',
    description: 'Security work on the software you run: authentication, permissions, secrets, dependencies, and hardening, reviewed and fixed by the team that builds it.',
    getEyebrow: 'What you get',
    getTitle: 'Closed doors, checked twice.',
    features: [
      ['Sign-in done properly', 'Sessions, password rules, and two-factor, built the way they are meant to be built.'],
      ['Permissions that hold', 'Checked on the server, not just hidden in the interface.'],
      ['Secrets where they belong', 'Keys and passwords out of the code and out of your repository.'],
      ['Dependencies brought current', 'The libraries underneath you updated, and kept that way.'],
      ['Hardened hosting', 'Locked-down access, encryption in transit and at rest, sensible defaults.'],
      ['A written review', 'What we found, what we fixed, and what you should do next.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For before you need it.',
    forLede: 'Security is cheap to add on purpose and expensive to add after an incident, a failed questionnaire, or a customer asking hard questions.',
    forCards: [
      ['Handling customer data', 'Names, payments, or anything you would hate to see leaked.'],
      ['Selling to bigger companies', 'A security questionnaire is now standing between you and the deal.'],
      ['Nobody has ever checked', 'The software works, and no one has looked at this side of it.'],
    ],
    faq: [
      ['Is this a penetration test?', 'It is a review and a fix. We look at how it is built, find the weaknesses, and repair them, rather than only producing a report.'],
      ['Can you work on software you did not build?', 'Yes. Most of this work is on software somebody else wrote.'],
      ['Will you help with a security questionnaire?', 'Yes. We can answer the technical parts and fix whatever the answers reveal.'],
      ['What does it cost?', 'A review has a one-time price. Fixes are quoted after it, as a one-time price or a monthly plan if you want it kept up.'],
    ],
  },
  {
    slug: 'move-to-the-cloud',
    nav: 'Move to the cloud',
    navBlurb: 'Reliable hosting in accounts you own',
    title: 'Move to the cloud',
    metaTitle: 'Move to the Cloud | Williams Systems LLC',
    headline: ['Off the old server,', 'without the drama.'],
    lede: 'Planned, rehearsed, and switched over with as little downtime as we can manage, into cloud accounts with your name on them.',
    description: 'Migrate from an old server or host into cloud infrastructure you own, with a planned cutover, tested backups, and a bill that makes sense.',
    getEyebrow: 'What you get',
    getTitle: 'A move with a plan behind it.',
    features: [
      ['A migration plan', 'What moves, in what order, and what happens if something goes wrong.'],
      ['Your accounts', 'Everything in accounts you own and control. No hostage situations.'],
      ['Data moved safely', 'Copied, checked, and verified against the old system before the switch.'],
      ['A rehearsed cutover', 'Practised first, then done at a time that suits you.'],
      ['Backups that restore', 'Automatic backups, and a restore we have actually tested.'],
      ['A smaller bill', 'Right-sized resources and unused services removed, which usually costs less than before.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For everything held together by one old box.',
    forLede: 'The server under someone\'s desk, the host nobody can log into, the setup that grew without a plan. It works, until the day it does not.',
    forCards: [
      ['Ageing hardware', 'A physical server you would rather not replace.'],
      ['A host you have outgrown', 'Slow, limited, or impossible to get support from.'],
      ['A setup nobody planned', 'Pieces added over years, with no map of what talks to what.'],
    ],
    faq: [
      ['How much downtime is there?', 'Usually minutes, planned for a quiet hour. We rehearse the cutover first so the real one is dull.'],
      ['Which cloud do you use?', 'Whichever suits the job, in your accounts. We will explain the trade-offs rather than just picking for you.'],
      ['Will it cost more to run?', 'Often less. Paying for what you actually use tends to beat paying for a box that sits idle.'],
      ['Do you run it afterwards?', 'We can. Monitoring, updates, and support are available as a monthly plan, or you can take it from there.'],
    ],
  },
  {
    slug: 'ongoing-support',
    nav: 'Ongoing support',
    navBlurb: 'Updates and new features after launch',
    title: 'Ongoing support',
    metaTitle: 'Ongoing Software Support | Williams Systems LLC',
    headline: ['Launch day is the start,', 'not the finish.'],
    lede: 'The same team that built it keeps it running, keeps it current, and keeps adding to it, on a monthly plan sized to what you actually need.',
    description: 'Ongoing support from the team that built your software: monitoring, updates, fixes, and new features on a monthly plan, with no handover to a stranger.',
    getEyebrow: 'What you get',
    getTitle: 'Someone who already knows your software.',
    features: [
      ['The same people', 'No handover to a support desk that has never seen your code.'],
      ['Watched while you sleep', 'Monitoring and alerts, so problems get found before your customers find them.'],
      ['Kept current', 'Updates and security patches applied as they come, not once a year.'],
      ['Fixes', 'Something broken gets looked at quickly, with a clear answer about what happened.'],
      ['New features', 'The list you have been adding to since launch, worked through a piece at a time.'],
      ['Backups that are checked', 'Taken automatically, and restored occasionally to prove they work.'],
    ],
    forEyebrow: "Who it's for",
    forTitle: 'For software that has to keep working.',
    forLede: 'Software is never finished. The question is whether the person maintaining it knows how it was built.',
    forCards: [
      ['After we launch you', 'The natural next step once your project goes live.'],
      ['Software someone else built', 'We can take it on, once we have reviewed it.'],
      ['No developer of your own', 'You need a team on call without hiring one.'],
    ],
    faq: [
      ['Is there a long contract?', 'No. Monthly, and you can stop. We would rather you stayed because it is worth it.'],
      ['How fast do you respond?', 'Agreed with you up front and written into the plan, so you know what you are getting.'],
      ['Do unused hours roll over?', 'We keep plans simple and talk to you when a month is quiet or busy, rather than counting minutes.'],
      ['Can you support software you did not build?', 'Usually. We review it first and tell you honestly whether we can look after it well.'],
    ],
  },
];

/* ── Shared shell ──────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const between = (text, startMark, endMark) => {
  const a = text.indexOf(startMark);
  const b = text.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error(`Could not find ${startMark} … ${endMark} in ${SHELL}`);
  return text.slice(a, b + endMark.length);
};

const shell = await readFile(join(ROOT, SHELL), 'utf8');
const brandDefs = between(shell, '<svg class="brand-defs"', '</svg>');
const headerBlock = between(shell, '<a class="skip-link"', '</header>');
const footerBlock = between(shell, '<footer class="site-footer"', '</footer>');
const ldOpen = '<script type="application/ld+json">';
const ldStart = shell.indexOf(ldOpen) + ldOpen.length;
const orgGraph = JSON.parse(shell.slice(ldStart, shell.indexOf('</script>', ldStart)));
const orgNode = orgGraph['@graph'][0];

/* ── One page ──────────────────────────────────────────────────────────── */

function pageHtml(s) {
  const url = `${SITE}/${s.slug}.html`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      orgNode,
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: s.title,
        serviceType: s.title,
        url,
        description: s.description,
        provider: { '@id': `${SITE}/#org` },
        areaServed: 'Worldwide',
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: s.metaTitle,
        about: { '@id': `${url}#service` },
        isPartOf: { '@id': `${SITE}/#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: s.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${SITE}/${SOLUTIONS[0].slug}.html` },
          { '@type': 'ListItem', position: 3, name: s.title, item: url },
        ],
      },
    ],
  };

  const others = SOLUTIONS.filter((o) => o.slug !== s.slug)
    .map((o) => `<a class="pd-other" href="${o.slug}.html"><b>${esc(o.nav)}</b><span>${esc(o.navBlurb)}</span></a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(s.metaTitle)}</title>
  <meta name="description" content="${esc(s.description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="author" content="Williams Systems LLC" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Williams Systems LLC" />
  <meta property="og:title" content="${esc(s.metaTitle)}" />
  <meta property="og:description" content="${esc(s.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/hero/code-poster.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(s.metaTitle)}" />
  <meta name="twitter:description" content="${esc(s.description)}" />
  <meta name="twitter:image" content="${SITE}/hero/code-poster.jpg" />
  <script type="application/ld+json">${JSON.stringify(graph)}</script>
  <meta name="theme-color" content="#0B0C10" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/styles/main.css" />
  <link rel="stylesheet" href="/src/styles/pages.css" />
  <script>document.documentElement.classList.add('js');</script>
</head>
<body class="page">
  ${brandDefs}
  ${headerBlock}

  <main id="main" class="product-page">
    <section class="pg-hero pd-hero">
      <div class="container">
        <p class="scene-eyebrow mono"><a href="${SOLUTIONS[0].slug}.html">Solutions</a> / ${esc(s.title)}</p>
        <h1 class="pg-title pd-title">${esc(s.headline[0])} <span>${esc(s.headline[1])}</span></h1>
        <p class="pg-lede">${esc(s.lede)}</p>
        <div class="pg-actions"><a class="btn btn-primary" href="schedule.html">Get started</a><a class="btn btn-ghost" href="./#process">See how we work</a></div>
      </div>
    </section>

    <section class="pg-section">
      <div class="container">
        <p class="scene-eyebrow mono">${esc(s.getEyebrow)}</p>
        <h2 class="pg-h2">${esc(s.getTitle)}</h2>
        <ul class="pd-features">
          ${s.features.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="pg-section">
      <div class="container pg-split">
        <div>
          <p class="scene-eyebrow mono">${esc(s.forEyebrow)}</p>
          <h2 class="pg-h2">${esc(s.forTitle)}</h2>
          <p class="pg-p">${esc(s.forLede)}</p>
        </div>
        <ul class="pg-cards pd-for">
          ${s.forCards.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="pg-section">
      <div class="container">
        <p class="scene-eyebrow mono">How it works</p>
        <h2 class="pg-h2">One team, from first call to launch.</h2>
        <ul class="pg-principles">
          <li><h3>We meet</h3><p>A free call about what you need, what it is worth to you, and whether we are the right people for it.</p></li>
          <li><h3>We agree the look</h3><p>Colours, layout, and feel settled with you before anything is built, so the first version already looks like yours.</p></li>
          <li><h3>You get it in writing</h3><p>A scope of work covering what we are building, how long it takes, and the price: a one-time cost for the job or a monthly plan, whichever fits.</p></li>
          <li><h3>We build it, fast</h3><p>Work starts as soon as you sign, you see it as it goes, and the same team supports it afterwards.</p></li>
        </ul>
        <p class="scene-eyebrow mono pd-stack-label">Why one team</p>
        <ul class="one-team-points pd-stack"><li>Design</li><li>Front end</li><li>Back end</li><li>Hosting</li><li>Security</li><li>Support</li></ul>
      </div>
    </section>

    <section class="pg-section">
      <div class="container pg-split">
        <div>
          <p class="scene-eyebrow mono">Questions</p>
          <h2 class="pg-h2">${esc(s.title)}, answered.</h2>
          <p class="pg-p">Don't see your question? <a class="pd-link" href="mailto:lwilliams24270@gmail.com">Ask us directly.</a></p>
        </div>
        <div class="faq-list">
          ${s.faq.map(([q, a], i) => `<details class="faq-item"${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="pg-section pg-cta">
      <div class="container">
        <h2 class="pg-h2 pd-cta-title">Let's build <span>yours.</span></h2>
        <p class="pg-p">Tell us what you need. We'll reply with a scope, a timeline, and a price, in plain English.</p>
        <div class="pg-actions"><a class="btn btn-primary btn-lg" href="schedule.html">Schedule a free call</a></div>
      </div>
    </section>

    <section class="pg-section pd-others-wrap">
      <div class="container">
        <p class="scene-eyebrow mono">Other solutions</p>
        <div class="pd-others">${others}</div>
      </div>
    </section>
  </main>

  <!-- ============ Footer · contact us ============ -->
  ${footerBlock}

  <script type="module" src="/src/js/main.js"></script>
</body>
</html>
`;
}

/* ── Point every menu at the new pages ─────────────────────────────────── */

function menuLinks(current) {
  return SOLUTIONS.map((s) => {
    const here = s.slug === current ? ' aria-current="page"' : '';
    return `<li><a href="${s.slug}.html"${here}><b>${esc(s.nav)}</b><span>${esc(s.navBlurb)}</span></a></li>`;
  }).join('\n              ');
}

function mobileLinks(current) {
  return SOLUTIONS.map((s) => {
    const here = s.slug === current ? ' aria-current="page"' : '';
    return `<a href="${s.slug}.html"${here}>${esc(s.nav)}</a>`;
  }).join('');
}

/** Replace the Solutions list in both the desktop mega-menu and the mobile menu. */
function rewriteMenus(html, current) {
  let out = html;

  const deskStart = out.indexOf('<div class="nav-menu" id="menu-solutions">');
  if (deskStart >= 0) {
    const ulStart = out.indexOf('<ul class="nav-menu-grid">', deskStart);
    const ulEnd = out.indexOf('</ul>', ulStart);
    out = out.slice(0, ulStart) + `<ul class="nav-menu-grid">\n              ${menuLinks(current)}\n            ` + out.slice(ulEnd);
  }

  const mobStart = out.indexOf('<p class="mnav-head mono">Solutions</p>');
  if (mobStart >= 0) {
    const from = mobStart + '<p class="mnav-head mono">Solutions</p>'.length;
    const to = out.indexOf('</div>', from);
    out = out.slice(0, from) + mobileLinks(current) + '\n      ' + out.slice(to);
  }
  return out;
}

/* ── Run ───────────────────────────────────────────────────────────────── */

let written = 0;
for (const s of SOLUTIONS) {
  await writeFile(join(ROOT, `${s.slug}.html`), rewriteMenus(pageHtml(s), s.slug), 'utf8');
  written += 1;
}

let touched = 0;
for (const name of (await readdir(ROOT)).filter((n) => n.endsWith('.html'))) {
  const slug = name.replace(/\.html$/, '');
  if (SOLUTIONS.some((s) => s.slug === slug)) continue; // just written
  const html = await readFile(join(ROOT, name), 'utf8');
  const next = rewriteMenus(html, null);
  if (next !== html) {
    await writeFile(join(ROOT, name), next, 'utf8');
    touched += 1;
  }
}

console.log(`Wrote ${written} solution page(s); updated the Solutions menu in ${touched} other page(s).`);
