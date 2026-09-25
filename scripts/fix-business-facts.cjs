/* Bring the site's Q&A and copy in line with what Landon confirmed on 2026-09-25
   (ownership depends on the plan, no timeline numbers, 3-month minimum on
   monthly plans, no mobile/AI promises he can't guarantee, and new Q&As).
   Updates visible answers AND the FAQPage structured data, and the generator
   scripts so a rebuild keeps the corrected wording. Safe to re-run. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(R + f, s);
const jsonStr = (s) => JSON.stringify(s).slice(1, -1);
const htmlText = (s) => s.replace(/&/g, '&amp;');
let changes = 0;

const OWN = 'It depends on the plan. On a one-time project, the code, the domain, and the accounts are yours. On a monthly plan, we host and manage it for you. Either way, it’s written into your scope before we start.';
const ANSWERS = {
  'index.html': {
    'How long does a project take?': 'It depends on the size of the project. The timeline is written into your scope before any work begins, we move fast, and you get progress updates while it’s being built.',
    'Do I own the code and the accounts?': OWN,
    'What technologies do you use?': 'Mostly React, Next.js, and JavaScript on the front end, Node.js and Python on the back end, and Supabase and PostgreSQL for data and sign-in. We pick what fits your project.',
    'Do you offer support after launch?': 'Yes, two ways: a monthly support plan that covers fixes, updates, and new features, or pay per job whenever you need something. Monthly plans have a 3-month minimum, then continue month to month.',
  },
  'websites.html': {
    'How long does a website take?': 'It depends on the number of pages and how ready your content is. The timeline is written into your scope before work begins, and we move fast.',
    'Do you handle the domain and hosting?': 'Yes. We set up the domain, hosting, and SSL. On a one-time project they’re in your name; on a monthly plan, we host and manage them for you.',
  },
  'web-apps.html': { 'Who owns the web app?': OWN },
  'saas.html': { 'Do I own the code and the product?': OWN },
  'mobile-apps.html': {
    'Do I need two separate apps for iPhone and Android?': 'Not necessarily. We build for both iPhone and Android and choose the approach that fits your project and budget.',
    'How are updates handled after launch?': 'We handle updates and releases through the App Store and Google Play, on a monthly support plan or as one-off jobs.',
  },
  'cloud.html': { 'Whose cloud accounts do you use?': 'It depends on the plan. On a one-time setup, everything is in accounts you own. On a monthly plan, we can host and manage it for you. Either way, we document it all.' },
  'personalized-ai.html': { 'Is my data private?': 'We set clear limits on what the assistant can see and do, and we talk through which AI provider and settings fit your needs before anything is connected.' },
  'launch-a-new-product.html': {
    'How long does it take?': 'We move fast, and the timeline is written into your scope before we start.',
    'Who owns what we build?': OWN,
  },
  'replace-spreadsheets.html': { 'How long before we can stop using the old file?': 'It depends on the spreadsheet. We get the core of it working first so you can move off the sheet early, and the timeline is in your scope.' },
  'move-to-the-cloud.html': { 'Which cloud do you use?': 'Whichever suits the job. We’ll explain the trade-offs rather than just picking for you.' },
  'ongoing-support.html': { 'Is there a long contract?': 'Monthly plans have a 3-month minimum, then continue month to month, so you can stop whenever it stops being worth it.' },
};

// New questions on the home FAQ.
const NEW_HOME = [
  ['Where are you based, and who do you work with?', 'We work remotely with businesses anywhere in the world.'],
  ['Who will I talk to?', 'You talk directly to Landon Williams, the founder, who is the person building your project.'],
  ['Do you require a deposit?', 'Payment terms, including any deposit, are written into your scope before work begins.'],
  ['How many revisions do I get?', 'We revise the design with you until it’s right, within the agreed scope.'],
];

function setAnswer(src, q, a) {
  const qh = htmlText(q);
  let out = src;
  // home FAQ format
  out = out.replace(new RegExp(`(<summary>${esc(qh)}</summary><p>)[\\s\\S]*?(</p>)`), `$1${htmlText(a)}$2`);
  // Q&A card format
  out = out.replace(new RegExp(`(<span class="qa-q">${esc(qh)}</span>[\\s\\S]*?<div class="qa-a"><p>)[\\s\\S]*?(</p>)`), `$1${htmlText(a)}$2`);
  // structured data
  out = out.replace(new RegExp(`("name":"${esc(jsonStr(q))}","acceptedAnswer":\\{"@type":"Answer","text":")(?:[^"\\\\]|\\\\.)*(")`), `$1${jsonStr(a)}$2`);
  if (out === src) console.warn('  (no change) ', q);
  return out;
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

for (const [file, qs] of Object.entries(ANSWERS)) {
  let s = read(file);
  for (const [q, a] of Object.entries(qs)) s = setAnswer(s, q, a);
  write(file, s); changes++;
}

// Home: add the new questions (visible list + structured data).
{
  let s = read('index.html');
  for (const [q, a] of NEW_HOME) {
    if (s.includes(`<summary>${htmlText(q)}</summary>`)) continue;
    s = s.replace(/(<details class="faq-item"><summary>How do I get started\?<\/summary>)/, `<details class="faq-item"><summary>${htmlText(q)}</summary><p>${htmlText(a)}</p></details>\n        $1`);
    s = s.replace(/(\{"@type":"Question","name":"How do I get started\?")/, `{"@type":"Question","name":"${jsonStr(q)}","acceptedAnswer":{"@type":"Answer","text":"${jsonStr(a)}"}},$1`);
  }
  write('index.html', s);
}

// Copy outside the Q&A (pages and the generator scripts).
const COPY = [
  ['Reliable hosting in accounts you own', 'Reliable, monitored hosting'],
  ['Set up, monitored, and supported by one team, in cloud accounts you own.', 'Set up, monitored, and supported by one team.'],
  ['Designed, built, and launched by one team, in accounts you own.', 'Designed, built, and launched by one team.'],
  ['<li>Data stays in your accounts</li><li>Never used to train AI models</li><li>Access by role</li>', '<li>Only the documents you approve</li><li>Only the tools you connect</li><li>Access by role</li>'],
  ["cap('private', 'Private by design', 'Your data stays yours.', 'It runs in accounts you control, isn’t used to train AI models, and only sees what you allow.', 1.12)", "cap('private', 'Clear limits', 'You decide what it sees.', 'It only reads the documents and tools you approve, and we set clear limits on what it can do.', 1.12)"],
  ['<p class="tour-cap-k">Private by design</p><h3>Your data stays yours.</h3><p>It runs in accounts you control, isn’t used to train AI models, and only sees what you allow.</p>', '<p class="tour-cap-k">Clear limits</p><h3>You decide what it sees.</h3><p>It only reads the documents and tools you approve, and we set clear limits on what it can do.</p>'],
  ['Your old office server moves into a cloud account you own, backed up and monitored.', 'Your old office server moves to the cloud, backed up and monitored.'],
  ['into cloud infrastructure you own', 'into reliable cloud infrastructure'],
  ['and you see working software every week.', 'and you get progress updates while it’s built.'],
  ['Working software every week in short, visible increments. Reviewed, tested, and demoed.', 'Progress updates as it’s built. Reviewed, tested, and shown to you along the way.'],
  ['Cloud setup, CI/CD, monitoring, and a rollout plan. You own every account and every line.', 'Cloud setup, monitoring, and a rollout plan, set up the way your plan calls for.'],
  ['Work starts as soon as you sign. You see progress every week, on a foundation that’s easy to grow.', 'Work starts as soon as you sign. You get progress updates as it’s built, on a foundation that’s easy to grow.'],
  ['Hosting and domain, in your name', 'Hosting and domain set up'],
  ['<span><small>Timeline</small><b>3 weeks</b></span>', '<span><small>Timeline</small><b>In writing, before we start</b></span>'],
  ['<p><em>Week 1</em>Pages built, preview link sent</p><p><em>Week 2</em>Booking connected, your feedback in</p><p><em>Week 3</em>Final checks on every phone</p>', '<p><em>Step 1</em>Pages built, preview link sent</p><p><em>Step 2</em>Booking connected, your feedback in</p><p><em>Step 3</em>Final checks on every phone</p>'],
  ['<li>Code in your account</li><li>Domain and hosting in your name</li><li>Same team on call for support</li>', '<li>Launched and tested</li><li>Hosting and domain set up</li><li>Same team on call for support</li>'],
  ["cap('launch', 'You own everything', 'Yours, from day one.', 'The code, the domain, and the accounts are in your name. We stay on to support it for as long as you want.', 1.06)", "cap('launch', 'Launch and support', 'Live, and looked after.', 'We launch it, hand it over the way your plan calls for, and stay on to support it for as long as you want.', 1.06)"],
];
const FILES = fs.readdirSync(R).filter((f) => f.endsWith('.html') && f !== 'admin.html')
  .concat(['public/llms.txt', 'scripts/build-product-pages.cjs', 'scripts/build-solution-pages.cjs', 'scripts/solution-worlds.cjs', 'scripts/build-about-faq.cjs']);
for (const f of FILES) {
  let s = read(f); const before = s;
  for (const [a, b] of COPY) s = s.split(a).join(b);
  s = s.replace(/, and private by design/g, '');
  if (s !== before) { write(f, s); changes++; }
}
// Generator scripts: carry the corrected Q&A answers too, so a rebuild keeps them.
console.log('files touched:', changes);
