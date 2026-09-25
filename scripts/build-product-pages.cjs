/* Rebuild the product pages (web apps, SaaS, mobile apps, cloud, personalized AI)
   in the same shape as websites.html: a scroll tour of a sample product, then
   "How it works", then the Q&A. Each page keeps its own <head> (title, meta,
   structured data), header, FAQ answers and footer.
   Usage: node scripts/build-product-pages.cjs */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..') + '/';
const read = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

const chrome = (url, tag = 'Sample') => `<div class="tw-chrome">
              <span class="tw-dots"><i></i><i></i><i></i></span>
              <span class="tw-url"><svg viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>${url}<b class="tw-live">Live</b></span>
              <span class="tw-sample">${tag}</span>
            </div>`;
const cap = (stop, k, h, p, pad) => `<li class="tour-cap" data-stop="${stop}"${pad ? ` data-pad="${pad}"` : ''}><p class="tour-cap-k">${k}</p><h3>${h}</h3><p>${p}</p></li>`;
const pill = (t, c) => `<span class="pill ${c}">${t}</span>`;

/* ------------------------------------------------------------------ sample products */
const PAGES = {
  'web-apps': {
    world: 'w-app',
    body: `
            ${chrome('app.northwind-ops.com')}
            <div class="app-shell">
              <aside class="app-side" data-stop="nav">
                <div class="app-logo"><i></i>Northwind Ops</div>
                <nav class="app-nav" data-anim="rise" data-delay="0.08"><span class="on">Dashboard</span><span>Orders</span><span>Customers</span><span>Inventory</span><span>Reports</span><span>Approvals</span><span>Settings</span></nav>
                <div class="app-user"><i>MC</i><div><b>Maya Chen</b><small>Admin</small></div></div>
              </aside>
              <main class="app-main">
                <div class="app-top"><span class="app-search">Search orders, customers…</span><span class="app-btn">+ New order</span></div>
                <section class="app-kpis-wrap" data-stop="kpis">
                  <div class="app-kpis">
                    <div class="kpi"><small>Revenue this month</small><b data-anim="count" data-count="128430" data-prefix="$">$128,430</b><em class="up">+12.4%</em></div>
                    <div class="kpi"><small>Open orders</small><b data-anim="count" data-count="342">342</b><em class="up">+18</em></div>
                    <div class="kpi"><small>On-time delivery</small><b data-anim="count" data-count="98.2" data-dec="1" data-suffix="%">98.2%</b><em class="up">+1.1%</em></div>
                    <div class="kpi"><small>Active customers</small><b data-anim="count" data-count="1284">1,284</b><em class="up">+64</em></div>
                  </div>
                  <div class="app-chart"><div class="app-chart-head"><b>Weekly revenue</b><span>Last 12 weeks</span></div>
                    <div class="bars" data-anim="grow" data-delay="0.12">${[42, 55, 48, 61, 58, 66, 72, 69, 78, 84, 80, 92].map((v) => `<i style="height:${v}%"></i>`).join('')}</div></div>
                </section>
                <section class="app-table" data-stop="table">
                  <div class="app-table-head"><b>Recent orders</b><span>Exported to spreadsheet: never again</span></div>
                  <div class="tr th"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span></div>
                  <div data-anim="rise" data-delay="0.08">
                    <div class="tr"><span>#4821</span><span>Harbor &amp; Bean</span><span>$1,240</span>${pill('Shipped', 'ok')}</div>
                    <div class="tr"><span>#4820</span><span>Blue Pine Dental</span><span>$860</span>${pill('Packing', 'wait')}</div>
                    <div class="tr"><span>#4819</span><span>Ridge Outfitters</span><span>$3,115</span>${pill('Shipped', 'ok')}</div>
                    <div class="tr"><span>#4818</span><span>Lakeside Studio</span><span>$420</span>${pill('Awaiting approval', 'hold')}</div>
                    <div class="tr"><span>#4817</span><span>Crest Auto</span><span>$2,390</span>${pill('Delivered', 'ok')}</div>
                  </div>
                </section>
                <div class="app-row">
                  <section class="app-card" data-stop="roles">
                    <b class="app-card-t">Team &amp; access</b>
                    <div class="role"><i>MC</i><span>Maya Chen</span>${pill('Owner', 'role')}</div>
                    <div class="role"><i>JR</i><span>Jordan Reyes</span>${pill('Manager', 'role')}</div>
                    <div class="role"><i>SK</i><span>Sam Kim</span>${pill('Staff', 'role')}</div>
                    <ul class="checks" data-anim="check" data-delay="0.14"><li>Staff can view orders</li><li>Managers approve refunds</li><li>Only owners see payroll</li></ul>
                  </section>
                  <section class="app-card" data-stop="auto">
                    <b class="app-card-t">Invoice approvals</b>
                    <ul class="flow" data-anim="check" data-delay="0.1"><li>Invoice #4812 received</li><li>Matched to purchase order</li><li>Within budget</li><li>Approved automatically</li></ul>
                  </section>
                </div>
                <section class="app-card app-int" data-stop="connect">
                  <b class="app-card-t">Integrations</b>
                  <div class="ints" data-anim="rise" data-delay="0.08">${['Stripe', 'QuickBooks', 'Gmail', 'Slack', 'Salesforce', 'Shopify'].map((n) => `<span><i>${n[0]}</i>${n}<em>Connected</em></span>`).join('')}</div>
                </section>
              </main>
            </div>`,
    pops: `<div class="tour-toast tour-pop" data-at="auto" data-delay="0.5" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Invoice #4812 approved</b><span>Automatically, in 3 seconds · no email chain</span></div></div>`,
    caps: [
      cap('nav', 'Internal tools', 'Everything in one place.', 'Orders, customers, inventory, and approvals in one app built around how your team already works.', 1.1),
      cap('kpis', 'Dashboards and reporting', 'Live numbers, not weekly spreadsheets.', 'The numbers that matter update on their own, instead of being rebuilt by hand every Monday.', 1.04),
      cap('table', 'Replace spreadsheets', 'No more copy and paste.', 'Your data lives in one safe place, and everyone sees the same, up-to-date version.', 1.04),
      cap('roles', 'Sign-in and roles', 'The right access for everyone.', 'Secure accounts with permissions for owners, managers, staff, and customers.', 1.1),
      cap('auto', 'Automation', 'Work that moves itself.', 'Approvals, reminders, and hand-offs happen on their own, so nothing waits in an inbox.', 1.1),
      cap('connect', 'Integrations', 'Plugs into your tools.', 'Payments, accounting, email, and your CRM, connected so data flows without retyping.', 1.06),
      cap('site', 'Launch', 'Your app, <span>live.</span>', 'Designed, built, and launched by one team, in accounts you own.', 1.04),
    ],
    design: 'We map out the screens and workflows with you: who uses it, what they need to see, and what happens next.',
    meet: 'A quick call about how your team works today: the spreadsheets, the manual steps, and what slows you down.',
  },

  saas: {
    world: 'w-saas',
    body: `
            ${chrome('tally.app')}
            <header class="s-nav"><span class="s-logo"><i></i>Tally</span><nav><span>Product</span><span>Pricing</span><span>Customers</span><span>Docs</span></nav><span class="s-btn">Start free trial</span></header>
            <section class="s-plans" data-stop="plans">
              <p class="s-kicker">Pricing</p><h3>Simple plans that grow with you.</h3>
              <div class="s-plan-row" data-anim="rise" data-delay="0.06">
                <div class="s-plan"><b>Starter</b><strong>$19<small>/mo</small></strong><span>For freelancers</span><ul><li>Unlimited invoices</li><li>1 user</li></ul><em class="s-btn ghost">Choose</em></div>
                <div class="s-plan hot"><i class="s-tag">Most popular</i><b>Pro</b><strong>$49<small>/mo</small></strong><span>For small teams</span><ul><li>Everything in Starter</li><li>5 users</li><li>Recurring billing</li></ul><em class="s-btn">Choose</em></div>
                <div class="s-plan"><b>Team</b><strong>$99<small>/mo</small></strong><span>For growing companies</span><ul><li>Everything in Pro</li><li>Unlimited users</li></ul><em class="s-btn ghost">Choose</em></div>
              </div>
            </section>
            <div class="s-row">
              <section class="s-card" data-stop="signup">
                <b class="s-card-t">Create your workspace</b>
                <label>Your name<span class="s-field" data-anim="type" data-fill="Alex Morgan"></span></label>
                <label>Work email<span class="s-field" data-anim="type" data-fill="alex@brightleaf.co"></span></label>
                <label>Workspace<span class="s-field" data-anim="type" data-fill="Brightleaf Studio"></span></label>
                <span class="s-btn wide" data-anim="press" data-delay="0.42">Create workspace</span>
              </section>
              <section class="s-card" data-stop="onboard">
                <b class="s-card-t">Welcome, Alex. Let's get you set up.</b>
                <ul class="checks big" data-anim="check" data-delay="0.1"><li>Add your logo</li><li>Invite your team</li><li>Connect Stripe</li><li>Send your first invoice</li></ul>
                <div class="s-progress"><i></i></div>
              </section>
            </div>
            <section class="s-metrics" data-stop="metrics">
              <div class="s-kpis">
                <div class="kpi"><small>Monthly recurring revenue</small><b data-anim="count" data-count="24580" data-prefix="$">$24,580</b><em class="up">+9.2%</em></div>
                <div class="kpi"><small>Active subscribers</small><b data-anim="count" data-count="512">512</b><em class="up">+37</em></div>
                <div class="kpi"><small>Trial to paid</small><b data-anim="count" data-count="31" data-suffix="%">31%</b><em class="up">+4%</em></div>
                <div class="kpi"><small>Churn</small><b data-anim="count" data-count="1.8" data-dec="1" data-suffix="%">1.8%</b><em class="up">−0.3%</em></div>
              </div>
              <div class="bars s-bars" data-anim="grow" data-delay="0.1">${[30, 34, 39, 42, 47, 51, 55, 58, 64, 69, 73, 80, 86, 92].map((v) => `<i style="height:${v}%"></i>`).join('')}</div>
            </section>
            <div class="s-row">
              <section class="s-card s-admin" data-stop="admin">
                <b class="s-card-t">Customers</b>
                <div class="tr th"><span>Company</span><span>Plan</span><span>Seats</span><span></span></div>
                <div data-anim="rise" data-delay="0.08">
                  <div class="tr"><span>Brightleaf Studio</span>${pill('Pro', 'role')}<span>4</span><em class="s-link">Manage</em></div>
                  <div class="tr"><span>Northwind Ops</span>${pill('Team', 'role')}<span>18</span><em class="s-link">Manage</em></div>
                  <div class="tr"><span>Ridge Outfitters</span>${pill('Starter', 'role')}<span>1</span><em class="s-link">Manage</em></div>
                  <div class="tr"><span>Blue Pine Dental</span>${pill('Pro', 'role')}<span>5</span><em class="s-link">Manage</em></div>
                </div>
              </section>
              <section class="s-card s-bill" data-stop="billing">
                <b class="s-card-t">Billing</b>
                <div class="s-inv"><span>Invoice INV-2041</span><b>$49.00</b></div>
                <div class="s-inv"><span>Pro plan · monthly</span>${pill('Paid', 'ok')}</div>
                <div class="s-stripe" data-anim="pop" data-delay="0.3">Payment processed by Stripe</div>
              </section>
            </div>`,
    pops: `<div class="tour-toast tour-pop" data-at="billing" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>New subscription: Pro plan</b><span>Brightleaf Studio · $49/month · card charged</span></div></div>`,
    caps: [
      cap('plans', 'Subscriptions', 'Charge on day one.', 'Plans, trials, upgrades, and invoices, built in from the start and handled through Stripe.', 1.04),
      cap('signup', 'Accounts and teams', 'Sign-up that just works.', 'Sign-up, sign-in, and team workspaces, with every customer’s data kept separate.', 1.1),
      cap('onboard', 'Onboarding', 'New users, up to speed.', 'Guide every new user to the moment your product clicks for them.', 1.1),
      cap('metrics', 'Analytics', 'Know what’s working.', 'See who signs up, what they use, and where they drop off, as it happens.', 1.04),
      cap('admin', 'Admin tools', 'Run it without the database.', 'See your customers, change plans, and help users from one screen.', 1.08),
      cap('billing', 'Payments', 'Money in, automatically.', 'Cards are charged, receipts are sent, and failed payments are retried for you.', 1.1),
      cap('site', 'Launch', 'Your product, <span>live.</span>', 'From idea to paying customers, built by one team.', 1.04),
    ],
    design: 'We design the plans, the sign-up and onboarding, and every screen your customers will see.',
    meet: 'A quick call about your idea, who will pay for it, and what the first version has to do.',
  },

  'mobile-apps': {
    world: 'w-mobile',
    body: `
            <div class="m-stage">
              <div class="m-glow"></div>
              <div class="m-phone" data-stop="home">
                <span class="m-notch"></span>
                <div class="m-status"><span>9:41</span><span>●●● ▮</span></div>
                <div class="m-push" data-stop="push" data-anim="pop" data-at="push" data-delay="0.1"><i></i><div><b>Pulse Studio</b><span>Sunrise Yoga starts in 30 minutes. See you there!</span></div></div>
                <p class="m-hi">Good morning, Alex</p>
                <div class="m-next"><small>Your next class</small><b>Sunrise Yoga</b><span>Tomorrow · 7:00 AM · Studio 2</span></div>
                <p class="m-sec">Popular this week</p>
                <div class="m-list" data-anim="rise" data-delay="0.1">
                  <div class="m-item"><i class="c1"></i><div><b>HIIT Express</b><span>30 min · Coach Dana</span></div><em>Book</em></div>
                  <div class="m-item"><i class="c2"></i><div><b>Power Cycle</b><span>45 min · Coach Ray</span></div><em>Book</em></div>
                  <div class="m-item"><i class="c3"></i><div><b>Stretch &amp; Flow</b><span>40 min · Coach Mia</span></div><em>Book</em></div>
                </div>
                <div class="m-tabs"><span class="on">Home</span><span>Classes</span><span>Profile</span></div>
              </div>
              <div class="m-phone android" data-stop="book">
                <div class="m-status"><span>9:41</span><span>▾ ▮</span></div>
                <div class="m-hero"><small>Tomorrow</small><b>Sunrise Yoga</b><span>60 min · Studio 2 · Coach Mia</span></div>
                <p class="m-sec">Pick a time</p>
                <ul class="m-slots" data-anim="check" data-delay="0.1"><li>6:00 AM</li><li>7:00 AM</li></ul>
                <p class="m-sec">Spots left</p>
                <div class="m-spots"><b data-anim="count" data-count="4">4</b><span> of 20</span></div>
                <div class="m-pay" data-stop="pay">
                  <p class="m-pay-t">Pay with</p>
                  <div class="m-card"><span>Visa ···· 4242</span><b>$15.00</b></div>
                  <span class="m-btn" data-anim="press" data-at="pay" data-delay="0.3">Book for $15</span>
                  <p class="m-ok" data-anim="pop" data-at="pay" data-delay="0.46">✓ Booked. See you tomorrow!</p>
                </div>
              </div>
              <div class="m-store" data-stop="store">
                <div class="m-store-top"><i></i><div><b>Pulse Studio</b><span>Book classes in two taps</span></div></div>
                <div class="m-stars"><b data-anim="count" data-count="4.9" data-dec="1">4.9</b><span>★★★★★</span><small>2,480 ratings</small></div>
                <div class="m-badges" data-anim="rise" data-delay="0.1"><span>Download on the App Store</span><span>Get it on Google Play</span></div>
              </div>
            </div>`,
    pops: '',
    caps: [
      cap('home', 'Fast and smooth', 'Feels right at home.', 'Native speed and gestures, with a home screen built around what your customers do most.', 1.08),
      cap('book', 'Built for your customers', 'Book in two taps.', 'The main job of your app is quick and obvious, on iPhone and Android alike.', 1.08),
      cap('pay', 'Sign-in and payments', 'Checkout in a tap.', 'Secure accounts, saved cards, and in-app payments, with no forms to fill in.', 1.15),
      cap('push', 'Push notifications', 'Bring people back.', 'Reminders, updates, and offers that land right on the lock screen.', 1.2),
      cap('store', 'Store launch', 'Live in both stores.', 'We handle App Store and Google Play setup, review, and release, under your accounts.', 1.1),
      cap('site', 'Launch', 'One app, <span>every phone.</span>', 'iPhone and Android from one codebase, built and launched by one team.', 1.04),
    ],
    design: 'We design every screen with you: the colors, the layout, and how it feels on iPhone and Android.',
    meet: 'A quick call about your customers and the one thing they should be able to do in your app.',
  },

  cloud: {
    world: 'w-cloud',
    body: `
            ${chrome('console.yourcompany.cloud', 'Sample console')}
            <div class="c-top"><span class="c-logo"><i></i>Cloud console</span><span class="c-env">production</span><span class="c-ok">All systems normal</span></div>
            <section class="c-card c-pipe" data-stop="deploy">
              <div class="c-head"><b>Deployments</b><span>main · commit 8f2c1a “Add booking page”</span></div>
              <ol class="c-steps" data-anim="check" data-delay="0.08"><li>Commit</li><li>Build</li><li>Tests (214 passed)</li><li>Security scan</li><li>Deploy</li></ol>
              <p class="c-note" data-anim="pop" data-delay="0.5">Live in 2m 14s · zero downtime</p>
            </section>
            <div class="c-row">
              <section class="c-card c-mon" data-stop="monitor">
                <div class="c-head"><b>Monitoring</b><span>last 24 hours</span></div>
                <div class="c-stats"><div><small>Uptime</small><b data-anim="count" data-count="99.99" data-dec="2" data-suffix="%">99.99%</b></div><div><small>Avg response</small><b data-anim="count" data-count="182" data-suffix=" ms">182 ms</b></div><div><small>Errors</small><b data-anim="count" data-count="0">0</b></div></div>
                <div class="bars c-bars" data-anim="grow" data-delay="0.12">${[40, 44, 38, 52, 48, 60, 55, 47, 42, 50, 58, 62, 57, 49, 45, 53, 61, 66, 59, 51].map((v) => `<i style="height:${v}%"></i>`).join('')}</div>
              </section>
              <section class="c-card c-back" data-stop="backups">
                <div class="c-head"><b>Backups</b><span>nightly · kept 30 days</span></div>
                <div data-anim="rise" data-delay="0.08">
                  <div class="c-line"><span>Database · today 2:00 AM</span>${pill('Verified', 'ok')}</div>
                  <div class="c-line"><span>Files · today 2:05 AM</span>${pill('Verified', 'ok')}</div>
                  <div class="c-line"><span>Database · yesterday</span>${pill('Verified', 'ok')}</div>
                  <div class="c-line"><span>Restore drill · Sunday</span>${pill('Passed', 'ok')}</div>
                </div>
              </section>
            </div>
            <div class="c-row">
              <section class="c-card" data-stop="secure">
                <div class="c-head"><b>Security</b><span>checked daily</span></div>
                <ul class="checks big dark" data-anim="check" data-delay="0.08"><li>TLS on every endpoint</li><li>Two-factor sign-in for all admins</li><li>Secrets in a vault, not in code</li><li>Systems patched this week</li><li>Firewall and least-privilege access</li></ul>
              </section>
              <section class="c-card c-cost" data-stop="cost">
                <div class="c-head"><b>Monthly cost</b><span>right-sized</span></div>
                <b class="c-big" data-anim="count" data-count="412" data-prefix="$">$412</b><span class="c-down">38% less than last quarter</span>
                <div class="c-usage"><span>Servers</span><i style="--w:62%"></i><span>Database</span><i style="--w:48%"></i><span>Storage</span><i style="--w:30%"></i></div>
              </section>
            </div>`,
    pops: `<div class="tour-toast tour-pop" data-at="monitor" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Alert resolved automatically</b><span>Traffic spike handled · extra server added for 12 minutes</span></div></div>`,
    caps: [
      cap('deploy', 'Automatic deployments', 'Ship without the stress.', 'Every change is built, tested, scanned, and released the same safe way, with zero downtime.', 1.06),
      cap('monitor', 'Monitoring and alerts', 'Know first.', 'Uptime, speed, and errors are watched around the clock, so problems are fixed before customers notice.', 1.08),
      cap('backups', 'Backups and recovery', 'Nothing gets lost.', 'Automatic nightly backups, verified and restore-tested, kept in your own accounts.', 1.08),
      cap('secure', 'Security hardening', 'Locked down by default.', 'Encrypted traffic, two-factor sign-in, secrets kept out of code, and systems kept up to date.', 1.08),
      cap('cost', 'Cost control', 'Pay for what you use.', 'Right-sized servers and storage, so you are not paying for capacity you never touch.', 1.1),
      cap('site', 'Launch', 'Infrastructure that <span>just works.</span>', 'Set up, monitored, and supported by one team, in cloud accounts you own.', 1.04),
    ],
    design: 'We plan the setup with you: hosting, deployments, monitoring, backups, and who can access what.',
    meet: 'A quick call about what you run today, where it’s hosted, and what keeps you up at night.',
  },

  'personalized-ai': {
    world: 'w-ai',
    body: `
            ${chrome('assistant.yourbusiness.com')}
            <div class="ai-shell">
              <aside class="ai-side">
                <div class="ai-logo"><i></i>Your Assistant</div>
                <section class="ai-block" data-stop="knows">
                  <b class="ai-t">What it knows</b>
                  <div data-anim="rise" data-delay="0.08">
                    <span class="ai-src"><i class="pdf"></i>Price list 2026.pdf</span>
                    <span class="ai-src"><i class="doc"></i>Return policy.docx</span>
                    <span class="ai-src"><i class="xls"></i>Product catalog.xlsx</span>
                    <span class="ai-src"><i class="mail"></i>Customer emails (1,240)</span>
                    <span class="ai-src"><i class="web"></i>yourbusiness.com</span>
                  </div>
                </section>
                <section class="ai-block ai-private" data-stop="private">
                  <b class="ai-t">Privacy</b>
                  <ul class="checks" data-anim="check" data-delay="0.1"><li>Data stays in your accounts</li><li>Never used to train AI models</li><li>Access by role</li></ul>
                </section>
              </aside>
              <main class="ai-main">
                <section class="ai-chat" data-stop="chat">
                  <div data-anim="rise" data-delay="0.06">
                    <div class="msg me">Can a customer return a used item?</div>
                    <div class="msg ai">Yes, within 30 days if it’s in the original packaging. Used items get store credit rather than a refund. Want me to reply to Sam Rivera’s email with that?<span class="ai-cite">Source: Return policy.docx</span></div>
                    <div class="msg me">Yes, and book a call with Sam next week.</div>
                  </div>
                </section>
                <section class="ai-action" data-stop="action">
                  <b class="ai-t">Draft reply to Sam Rivera</b>
                  <p class="ai-draft"><span data-anim="type" data-fill="Hi Sam, thanks for reaching out! You can return the item within 30 days for store credit. I’ve booked a quick call for Tuesday at 10:00 AM to sort it out. Talk soon, Alex"></span></p>
                  <div class="ai-act-row"><span class="ai-btn" data-anim="press" data-delay="0.5">Send</span><span class="ai-btn ghost">Edit</span><span class="ai-meet" data-anim="pop" data-delay="0.56">📅 Tue 10:00 AM added to calendar</span></div>
                </section>
              </main>
              <aside class="ai-right">
                <section class="ai-block" data-stop="tools">
                  <b class="ai-t">Connected tools</b>
                  <div class="ai-tools" data-anim="rise" data-delay="0.08">${['Gmail', 'Google Calendar', 'HubSpot', 'Slack', 'QuickBooks', 'Your database'].map((n) => `<span><i>${n[0]}</i>${n}<em></em></span>`).join('')}</div>
                </section>
                <section class="ai-block" data-stop="where">
                  <b class="ai-t">Where it works</b>
                  <div class="ai-where" data-anim="rise" data-delay="0.08"><span>Website chat</span><span>Slack</span><span>Microsoft Teams</span><span>Text message</span><span>Inside your app</span></div>
                </section>
              </aside>
            </div>`,
    pops: `<div class="tour-toast tour-pop" data-at="action" data-delay="0.62" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Email sent · call booked</b><span>Sam Rivera · Tuesday, 10:00 AM</span></div></div>`,
    caps: [
      cap('knows', 'Knows your business', 'Trained on what you know.', 'Your price lists, policies, products, and past emails, so its answers are yours, not generic guesses.', 1.1),
      cap('chat', 'Sounds like you', 'Answers in your voice.', 'It answers your team and your customers in your tone, and shows where each answer came from.', 1.08),
      cap('action', 'Takes action', 'Does the work, not just chat.', 'It drafts the email, books the meeting, and updates your records when you say so.', 1.08),
      cap('tools', 'Connected to your tools', 'Plugged into your business.', 'Email, calendar, CRM, accounting, and your own software, connected so it can act.', 1.1),
      cap('where', 'Where you already work', 'Right where you are.', 'On your website, in Slack or Teams, over text, or inside your own app.', 1.1),
      cap('private', 'Private by design', 'Your data stays yours.', 'It runs in accounts you control, isn’t used to train AI models, and only sees what you allow.', 1.12),
      cap('site', 'Launch', 'Your AI, <span>built for you.</span>', 'Designed, built, and tuned by one team, around how you work.', 1.04),
    ],
    design: 'We decide together what it should know, how it should sound, and what it’s allowed to do.',
    meet: 'A quick call about your business, the questions you answer every day, and the busywork you want gone.',
  },
};

/* ------------------------------------------------------------------ page assembly */
for (const [slug, P] of Object.entries(PAGES)) {
  const f = `${slug}.html`;
  let src = read(f);
  if (src.includes('id="tour"')) { console.log(f, 'already converted, skipped'); continue; }

  const name = src.match(/<p class="scene-eyebrow mono"><a href="\.\/#services">Products<\/a> \/ ([^<]+)<\/p>/)[1];
  const h1 = src.match(/<h1 class="pg-title pd-title">([\s\S]*?)<\/h1>/)[1];
  const lede = src.match(/<p class="pg-lede">([\s\S]*?)<\/p>/)[1];
  const faqs = [...src.matchAll(/<details class="faq-item"( open)?><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [m[2], m[3]]);
  if (!faqs.length) throw new Error('no FAQ in ' + f);
  const allCaps = [`<li class="tour-cap tour-intro" data-stop="intro"><h1 class="tour-h1" id="pageTitle">${h1}</h1><p>${lede}</p><div class="tour-actions"><a class="btn btn-primary" href="schedule.html">Get started</a><span class="tour-hint mono">Scroll to take the tour ↓</span></div></li>`, ...P.caps];

  const main = `  <main id="main" class="product-page">
    <!-- ============ Product tour ============
         A sample product seen up close; the camera glides across it as you
         scroll (src/js/site-tour.js). The business shown is fictional.
         Generated by scripts/build-product-pages.cjs. -->
    <section class="tour" id="tour" aria-labelledby="pageTitle">
      <div class="tour-stage">
        <div class="tour-window" aria-hidden="true">
          <div class="tour-viewport">
          <div class="tw-world ${P.world}" id="tourWorld">${P.body}
          </div>
          </div>
          ${P.pops}
        </div>

        <div class="tour-captions">
          <p class="scene-eyebrow mono"><a href="./#services">Products</a> / ${name}</p>
          <ol class="tour-caps">
            ${allCaps.join('\n            ')}
          </ol>
          <ul class="tour-dots" aria-hidden="true">${'<li></li>'.repeat(allCaps.length)}</ul>
        </div>
      </div>
    </section>

    <section class="pg-section">
      <div class="container">
        <p class="scene-eyebrow mono">How it works</p>
        <h2 class="pg-h2 ws-flow-title">Meet. Design. Scope. <span>Built fast.</span></h2>
        <p class="pg-p">A simple process with no surprises. You know exactly what you're getting and what it costs before any work begins.</p>
        <ol class="ws-flow">
          <li><h3>Meet</h3><p>${P.meet}</p></li>
          <li><h3>Design</h3><p>${P.design}</p></li>
          <li><h3>Scope</h3><p>You get a written scope of work listing every feature, the price, and the timeline.</p></li>
          <li><h3>Build</h3><p>Approve the scope and we start right away. We build fast and keep you updated until it's live.</p></li>
        </ol>
        <div class="ws-promises">
          <div class="ws-promise win-card">
            <h3>Clear, upfront pricing</h3>
            <p>Some projects are a one-time price and some are a simple monthly plan, whichever fits your business. Either way, the price is set in your scope before we start, with no surprise invoices.</p>
          </div>
          <div class="ws-promise win-card">
            <h3>Fast turnaround</h3>
            <p>Work starts as soon as you approve the scope, and we move quickly, so you're up and running fast.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="pg-section">
      <div class="container pg-split">
        <div>
          <p class="scene-eyebrow mono">Questions</p>
          <h2 class="pg-h2 qa-title">${name}, <span>answered.</span></h2>
          <p class="pg-p">Straight answers to what people ask before we start.</p>
          <div class="qa-ask"><p>Don't see your question?</p><a class="btn btn-primary btn-sm" href="schedule.html">Ask us on a free call</a><a class="qa-mail" href="mailto:lwilliams24270@gmail.com">lwilliams24270@gmail.com</a></div>
        </div>
        <div class="faq-list qa-list">
${faqs.map(([q, a], i) => `          <details class="faq-item qa-item"${i === 0 ? ' open' : ''}><summary><span class="qa-q">${q}</span><span class="qa-icon" aria-hidden="true"></span></summary><div class="qa-a"><p>${a}</p></div></details>`).join('\n')}
        </div>
      </div>
    </section>
  </main>`;

  const a = src.indexOf('  <main id="main"');
  const b = src.indexOf('  </main>') + '  </main>'.length;
  src = src.slice(0, a) + main + src.slice(b);
  src = src.replace('<link rel="stylesheet" href="/src/styles/pages.css" />', '<link rel="stylesheet" href="/src/styles/pages.css" />\n  <link rel="stylesheet" href="/src/styles/tour.css" />\n  <link rel="stylesheet" href="/src/styles/product-worlds.css" />');
  src = src.replace('<script type="module" src="/src/js/main.js"></script>', '<script type="module" src="/src/js/main.js"></script>\n  <script type="module" src="/src/js/site-tour.js"></script>');
  fs.writeFileSync(R + f, src);
  console.log(f, '→', allCaps.length, 'stops,', faqs.length, 'questions');
}
