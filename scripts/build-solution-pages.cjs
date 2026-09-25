/* Rebuild the six Solutions pages in the product-page shape: a scroll tour of a
   sample product, "How it works", and the Q&A cards. Each page keeps its own
   <head>, headline, intro line, FAQ answers and footer, and each has its own
   sample product (scripts/solution-worlds.cjs, styles in
   src/styles/solution-worlds.css and product-worlds.css).
   Usage: node scripts/build-solution-pages.cjs
   (Run it on the original generated pages; converted pages are skipped.) */
const fs = require('fs');
const path = require('path');
const { chrome, cap, pill, assemble } = require('./build-product-pages.cjs');
const W = require('./solution-worlds.cjs');

const support = {
  world: 'w-support',
  body: `
            ${chrome('support.williamssystems.dev', 'Sample portal')}
            <div class="sp-top"><span class="sp-logo"><i></i>Client support</span><span class="sp-client">Harbor &amp; Bean</span><span class="sp-plan">Monthly support plan</span></div>
            <div class="sp-grid">
              <section class="sp-card sp-new" data-stop="requests">
                <b class="sp-t">New request</b>
                <label>What do you need?<span class="sp-field" data-anim="type" data-fill="Add a holiday hours banner to the homepage"></span></label>
                <label>Priority<span class="sp-field" data-anim="type" data-fill="This week"></span></label>
                <span class="sp-btn" data-anim="press" data-delay="0.36">Send request</span>
                <p class="sp-sent" data-anim="pop" data-delay="0.46">✓ Received. We're on it.</p>
              </section>
              <section class="sp-card sp-chat" data-stop="contact">
                <b class="sp-t">Messages</b>
                <div data-anim="rise" data-delay="0.08">
                  <div class="msg me">Can we also add the new pastry to the menu?</div>
                  <div class="msg them"><i>LW</i>Yes! Adding it today, with the photo you sent. I'll message you when it's live.</div>
                  <p class="sp-meta">Replied in 12 minutes · the same team that built your site</p>
                </div>
              </section>
            </div>
            <section class="sp-card sp-board" data-stop="board">
              <b class="sp-t">Your requests</b>
              <div class="sp-cols">
                <div class="sp-col"><small>To do</small><div class="sp-tk">Holiday hours banner<em>This week</em></div><div class="sp-tk">New pastry on the menu<em>Today</em></div></div>
                <div class="sp-col"><small>In progress</small><div class="sp-tk">Speed up the gallery page<em>Tomorrow</em></div></div>
                <div class="sp-col done" data-anim="rise" data-delay="0.1"><small>Done</small><div class="sp-tk">Fix the contact form on phones<em>✓ Shipped</em></div><div class="sp-tk">Add gift card link<em>✓ Shipped</em></div><div class="sp-tk">Update opening hours<em>✓ Shipped</em></div></div>
              </div>
            </section>
            <div class="sp-grid">
              <section class="sp-card" data-stop="release">
                <b class="sp-t">Release notes · this month</b>
                <ul class="checks big" data-anim="check" data-delay="0.08"><li>Security updates installed</li><li>Contact form fixed on phones</li><li>Gallery loads twice as fast</li><li>Gift card link added</li></ul>
              </section>
              <section class="sp-card" data-stop="health">
                <b class="sp-t">Site health</b>
                <div class="sp-stats"><div><small>Uptime</small><b data-anim="count" data-count="99.98" data-dec="2" data-suffix="%">99.98%</b></div><div><small>Load time</small><b data-anim="count" data-count="0.9" data-dec="1" data-suffix=" s">0.9 s</b></div><div><small>Backups</small><b>${pill('Verified', 'ok')}</b></div></div>
                <div class="bars sp-bars" data-anim="grow" data-delay="0.1">${[70, 74, 72, 78, 76, 80, 83, 81, 85, 88, 86, 90].map((v) => `<i style="height:${v}%"></i>`).join('')}</div>
              </section>
            </div>`,
  pops: `<div class="tour-toast tour-pop" data-at="board" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Request shipped</b><span>Update opening hours · live on your site</span></div></div>`,
};

const S = {
  'launch-a-new-product': { from: W.launch, caps: [
    cap('landing', 'Start with interest', 'A waitlist before launch.', 'A landing page that explains the idea and collects sign-ups, so you launch to people already waiting.', 1.05),
    cap('mvp', 'Focused first version', 'Ship the part that matters.', 'We help you pick the few features that prove the idea, and build those well.', 1.1),
    cap('launchday', 'Launch day', 'Real users, real numbers.', 'Sign-ups, paying customers, and ratings you can see from the first hour.', 1.1),
    cap('feedback', 'Learn fast', 'Hear what users want next.', 'Early feedback shapes version two, so you build what people actually ask for.', 1.05),
    cap('site', 'Launch', 'Your idea, <span>live.</span>', 'From first sketch to real users, built by one team.', 1.04),
  ], meet: 'A quick call about your idea, who it’s for, and what the first version has to do.', design: 'We design the screens with you and agree the smallest version that proves the idea.' },

  'modernize-an-app': { from: W.modern, caps: [
    cap('before', 'Before', 'Slow, dated, and breaking.', 'Old screens, cryptic errors, and pages that take seconds to load. Your team works around it every day.', 1.08),
    cap('after', 'After', 'The same app, rebuilt modern.', 'A clean, fast design with the same data and workflows your team already knows.', 1.08),
    cap('speed', 'Faster', '10× quicker pages.', 'We find what slows it down and fix it, so waiting on the app is a thing of the past.', 1.12),
    cap('fixes', 'Fixed and safer', 'Bugs gone, security current.', 'Crashes fixed, old libraries updated, secure sign-in, and tests so it stays fixed.', 1.1),
    cap('mobile', 'Anywhere', 'Works on every screen.', 'The modernized app works on phones and tablets, not just the office PC.', 1.12),
    cap('site', 'Relaunch', 'Your app, <span>like new.</span>', 'Reviewed, fixed, and modernized by one team, without starting over.', 1.04),
  ], meet: 'A quick call about the app you have, what’s broken, and what it needs to do next.', design: 'We review the code and the screens with you and agree what to keep, fix, and refresh.' },

  'replace-spreadsheets': { from: W.sheet, caps: [
    cap('sheet', 'Today', 'The file everyone fears.', 'Five tabs, broken formulas, and three people overwriting each other. Sound familiar?', 1.05),
    cap('jobs', 'Tomorrow', 'Every job in one place.', 'The spreadsheet becomes a real schedule the whole team sees, always up to date.', 1.05),
    cap('field', 'From the field', 'No more retyping.', 'Crews log work from their phones, and the office sees it instantly.', 1.12),
    cap('report', 'Reports', 'Your weekly numbers, ready.', 'Jobs and revenue add themselves up, instead of being rebuilt every Monday.', 1.12),
    cap('history', 'Every change recorded', 'Know who changed what.', 'A clear history of every edit, so a wrong number always has an explanation.', 1.1),
    cap('site', 'Switch over', 'Your spreadsheet, <span>retired.</span>', 'Your data is brought across and checked with you before you switch.', 1.04),
  ], meet: 'A quick call where you walk us through the spreadsheet and how your team uses it.', design: 'We turn your tabs and steps into screens, and agree the look with you.' },

  'secure-your-software': { from: W.shield, caps: [
    cap('login', 'Secure sign-in', 'A password isn’t enough.', 'Two-step sign-in keeps accounts safe even when a password leaks.', 1.1),
    cap('blocked', 'Attacks stopped', 'Blocked before they get in.', 'Password guessing and bots are spotted and shut out automatically.', 1.1),
    cap('scan', 'Checked', 'No known weak spots.', 'We scan for and fix outdated libraries, weak storage, and unencrypted traffic.', 1.06),
    cap('access', 'Least access', 'People see only what they need.', 'Access set by role, so staff never stumble into payroll or payments.', 1.1),
    cap('audit', 'Accountable', 'Every action on record.', 'An audit log shows who did what and when, and flags anything unusual.', 1.1),
    cap('site', 'Secured', 'Software you can <span>trust.</span>', 'Reviewed, hardened, and watched by one team.', 1.04),
  ], meet: 'A quick call about what you run, who has access, and what worries you.', design: 'We review your setup and agree, in plain English, what to fix first.' },

  'move-to-the-cloud': { from: W.migrate, caps: [
    cap('map', 'The move', 'From the closet to the cloud.', 'Your old office server moves to the cloud, backed up and monitored.', 1.06),
    cap('plan', 'A clear plan', 'Every step agreed first.', 'You know exactly what moves, when, and how it’s tested before anything changes.', 1.1),
    cap('transfer', 'Safe copy', 'Every file, checked.', 'Your data is copied and verified against the original, so nothing gets lost.', 1.1),
    cap('switch', 'Switch-over', 'Zero downtime.', 'We switch over overnight, so your team arrives Monday to a faster system.', 1.1),
    cap('savings', 'After', 'Often a smaller bill.', 'Cloud costs sized to what you use, with backups and monitoring included.', 1.1),
    cap('site', 'Moved', 'In the cloud, <span>for good.</span>', 'Migrated, set up, and supported by one team.', 1.04),
  ], meet: 'A quick call about what you run today and where it’s hosted.', design: 'We plan the new setup and the move with you, step by step.' },

  'ongoing-support': { from: support, caps: [
    cap('requests', 'Just ask', 'Send a request, any time.', 'Changes, fixes, or new ideas: send them in and they go straight on our list.', 1.1),
    cap('board', 'Handled', 'See it get done.', 'Every request tracked from to-do to done, so you always know where things stand.', 1.05),
    cap('release', 'Kept current', 'Updates, shipped regularly.', 'Fixes, security updates, and new features released on a steady rhythm.', 1.1),
    cap('health', 'Watched', 'Kept healthy.', 'Uptime and speed monitored, with problems fixed before they reach your customers.', 1.1),
    cap('contact', 'Same team', 'A direct line to the builders.', 'The people who built it answer your messages, not a call center.', 1.1),
    cap('site', 'Support', 'Looked after, <span>long term.</span>', 'The same team, for as long as you want us.', 1.04),
  ], meet: 'A quick call about your software and what you need help with.', design: 'We agree how you’ll send requests and how quickly you’ll hear back.' },
};

const LINK = '<link rel="stylesheet" href="/src/styles/product-worlds.css" />';
for (const [slug, s] of Object.entries(S)) {
  assemble(`${slug}.html`, { world: s.from.world, body: s.from.body, pops: s.from.pops, caps: s.caps, meet: s.meet, design: s.design });
  const file = path.join(__dirname, '..', `${slug}.html`);
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('solution-worlds.css')) html = html.replace(LINK, `${LINK}\n  <link rel="stylesheet" href="/src/styles/solution-worlds.css" />`);
  fs.writeFileSync(file, html);
}
