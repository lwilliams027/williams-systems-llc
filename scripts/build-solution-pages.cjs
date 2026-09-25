/* Rebuild the six Solutions pages in the product-page shape: a scroll tour of a
   sample product, "How it works", and the Q&A cards. Each page keeps its own
   <head>, headline, intro line, FAQ answers and footer. Five pages reuse the
   product-page samples with their own captions; Ongoing support has its own.
   Usage: node scripts/build-solution-pages.cjs */
const { PAGES, chrome, cap, pill, assemble } = require('./build-product-pages.cjs');

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
  'launch-a-new-product': { from: PAGES.saas, caps: [
    cap('plans', 'Ready to sell', 'Charging from day one.', 'Sign-up, plans, and payments built in, so your first customers can pay.', 1.04),
    cap('signup', 'Real accounts', 'People can sign up today.', 'Secure sign-up and sign-in from the first release, not bolted on later.', 1.1),
    cap('onboard', 'First impressions', 'New users get it fast.', 'Onboarding that walks every new user to the moment your product makes sense.', 1.1),
    cap('metrics', 'Learn as you go', 'See what’s working.', 'Numbers on sign-ups and usage from launch day, so the next version is based on facts.', 1.04),
    cap('admin', 'Room to grow', 'Built past launch.', 'An admin panel and a solid foundation, so version two is an upgrade, not a rewrite.', 1.08),
    cap('site', 'Launch', 'Your product, <span>live.</span>', 'From idea to real users, built by one team.', 1.04),
  ], meet: 'A quick call about your idea, who it’s for, and what the first version has to do.', design: 'We design the screens with you and agree the smallest version that proves the idea.' },

  'modernize-an-app': { from: PAGES['web-apps'], caps: [
    cap('nav', 'Cleaner', 'A modern look people like.', 'A refreshed design and clearer layout, without losing the workflows people rely on.', 1.1),
    cap('kpis', 'Faster', 'Loads in a blink.', 'We find what’s slowing it down and fix it, so your app feels new again.', 1.04),
    cap('table', 'Fixed', 'The bugs, finally gone.', 'We review the code, fix what’s broken, and add tests so it stays fixed.', 1.04),
    cap('roles', 'Safer', 'Up-to-date security.', 'Old dependencies updated, sign-in hardened, and access set by role.', 1.1),
    cap('connect', 'Connected', 'Works with your newer tools.', 'Integrations with the tools you use today, replacing manual exports.', 1.06),
    cap('site', 'Relaunch', 'Your app, <span>like new.</span>', 'Reviewed, fixed, and modernized by one team, without starting over.', 1.04),
  ], meet: 'A quick call about the app you have, what’s broken, and what it needs to do next.', design: 'We review the code and the screens with you and agree what to keep, fix, and refresh.' },

  'replace-spreadsheets': { from: PAGES['web-apps'], caps: [
    cap('nav', 'One place', 'Every tab becomes a screen.', 'Orders, customers, and stock in one app instead of twelve tabs.', 1.1),
    cap('kpis', 'Reports without the rebuild', 'Your weekly numbers, ready.', 'The report you rebuild every Monday updates itself.', 1.04),
    cap('table', 'Everyone at once', 'No more final-v3-REAL.', 'The whole team works in the same data at the same time, always current.', 1.04),
    cap('roles', 'Permissions', 'People see what they should.', 'Access by role, and a record of who changed what.', 1.1),
    cap('auto', 'Rules that hold', 'Steps that run themselves.', 'Checks and approvals happen automatically, so nothing gets missed.', 1.1),
    cap('site', 'Switch over', 'Your spreadsheet, <span>retired.</span>', 'Your data is brought across and checked with you before you switch.', 1.04),
  ], meet: 'A quick call where you walk us through the spreadsheet and how your team uses it.', design: 'We turn your tabs and steps into screens, and agree the look with you.' },

  'secure-your-software': { from: PAGES.cloud, caps: [
    cap('deploy', 'Safe releases', 'Every change is checked.', 'Automatic tests and security scans run before anything goes live.', 1.06),
    cap('monitor', 'Watched', 'Trouble spotted early.', 'Monitoring and alerts around the clock, so issues are caught before they cost you.', 1.08),
    cap('backups', 'Recoverable', 'Backups you can count on.', 'Nightly backups, verified and restore-tested, so a bad day is not a disaster.', 1.08),
    cap('secure', 'Hardened', 'Locked down by default.', 'Encrypted traffic, two-factor sign-in, secrets out of the code, and systems kept patched.', 1.08),
    cap('site', 'Secured', 'Software you can <span>trust.</span>', 'Reviewed, hardened, and watched by one team.', 1.04),
  ], meet: 'A quick call about what you run, who has access, and what worries you.', design: 'We review your setup and agree, in plain English, what to fix first.' },

  'move-to-the-cloud': { from: PAGES.cloud, caps: [
    cap('deploy', 'Smooth move', 'Moved without the downtime.', 'We plan the migration and switch over with as little disruption as possible.', 1.06),
    cap('monitor', 'Reliable', 'Fast and always on.', 'Uptime and speed watched around the clock once you’re moved.', 1.08),
    cap('backups', 'Protected', 'Your data, safe.', 'Automatic, verified backups in accounts you own.', 1.08),
    cap('cost', 'Right-sized', 'Often a smaller bill.', 'Servers and storage sized to what you actually use.', 1.1),
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

for (const [slug, s] of Object.entries(S)) {
  assemble(`${slug}.html`, { world: s.from.world, body: s.from.body, pops: s.from.pops, caps: s.caps, meet: s.meet, design: s.design });
}
