/* Sample products for the Solutions pages, one per page, each with its own look.
   Styles: src/styles/product-worlds.css (w-launch, w-modern, w-sheet, w-shield, w-migrate). */
const { chrome, pill } = require('./build-product-pages.cjs');
const bars = (vals) => vals.map((v) => `<i style="height:${v}%"></i>`).join('');

/* ---------- Launch a new product: "Sprout", a plant-care startup going live ---------- */
const launch = {
  world: 'w-launch',
  body: `
            ${chrome('getsprout.app')}
            <header class="la-nav"><span class="la-logo"><i></i>sprout</span><nav><span>How it works</span><span>Pricing</span><span>Blog</span></nav><span class="la-pill">Launching Monday</span></header>
            <section class="la-hero" data-stop="landing">
              <div class="la-copy">
                <h3>Never kill a<br />houseplant again.</h3>
                <p>Sprout reminds you when to water, feed, and repot, for every plant you own.</p>
                <div class="la-wait"><span class="la-input" data-anim="type" data-fill="jordan@email.com"></span><span class="la-btn" data-anim="press" data-delay="0.3">Join the waitlist</span></div>
                <p class="la-count"><b data-anim="count" data-count="2140" data-delay="0.36">2,140</b> people on the waitlist</p>
              </div>
              <div class="la-art"><div class="la-pot"><i class="leaf l1"></i><i class="leaf l2"></i><i class="leaf l3"></i><span></span></div><div class="la-bubble">💧 Water your Monstera today</div></div>
            </section>
            <div class="la-row">
              <section class="la-card" data-stop="mvp">
                <b class="la-t">Version 1: what ships first</b>
                <ul class="checks big" data-anim="check" data-delay="0.08"><li>Add your plants with a photo</li><li>Watering reminders</li><li>Sign-up and accounts</li><li>Premium plan: $4/month</li></ul>
                <p class="la-later">Later: plant ID, community, shop</p>
              </section>
              <section class="la-card la-day" data-stop="launchday">
                <b class="la-t">Launch day</b>
                <div class="la-stats"><div><small>Sign-ups</small><b data-anim="count" data-count="1184">1,184</b></div><div><small>Premium</small><b data-anim="count" data-count="96">96</b></div><div><small>App rating</small><b data-anim="count" data-count="4.8" data-dec="1">4.8</b></div></div>
                <div class="bars la-bars" data-anim="grow" data-delay="0.1">${bars([12, 20, 34, 52, 71, 86, 94, 88, 80, 76, 70, 66])}</div>
              </section>
            </div>
            <section class="la-card la-fb" data-stop="feedback">
              <b class="la-t">What early users say</b>
              <div class="la-quotes" data-anim="rise" data-delay="0.08">
                <p>“My fern is alive for the first time ever.”<span>Priya, beta user</span></p>
                <p>“The reminders are exactly as often as they should be.”<span>Marcus, beta user</span></p>
                <p>“Would love plant ID next!”<span>Dana, beta user</span></p>
              </div>
            </section>`,
  pops: `<div class="tour-toast tour-pop" data-at="launchday" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>You're live on the App Store</b><span>Sprout 1.0 · 1,184 sign-ups today</span></div></div>`,
};

/* ---------- Modernize an app: before and after, side by side ---------- */
const modern = {
  world: 'w-modern',
  body: `
            <div class="mo-split">
              <section class="mo-old" data-stop="before">
                <div class="mo-oldbar">Inventory Manager v2.3 — [Orders]<span>_ □ ✕</span></div>
                <div class="mo-oldmenu"><span>File</span><span>Edit</span><span>Orders</span><span>Reports</span><span>Help</span></div>
                <div class="mo-oldgrid">
                  <div class="mo-oldrow h"><span>ID</span><span>CUST</span><span>AMT</span><span>STAT</span></div>
                  <div class="mo-oldrow"><span>4821</span><span>HARBOR&amp;BEAN</span><span>1240.00</span><span>SHP</span></div>
                  <div class="mo-oldrow"><span>4820</span><span>BLUEPINE</span><span>860.00</span><span>PCK</span></div>
                  <div class="mo-oldrow err"><span>4819</span><span>RIDGE OUTF</span><span>#ERR</span><span>???</span></div>
                  <div class="mo-oldrow"><span>4818</span><span>LAKESIDE</span><span>420.00</span><span>HLD</span></div>
                </div>
                <div class="mo-olderr">⚠ Runtime error 1004: Object not found. Contact your administrator.</div>
                <div class="mo-oldload">Loading… please wait <b>8.4 s</b></div>
              </section>
              <section class="mo-new" data-stop="after">
                <div class="mo-newbar"><span class="mo-logo"><i></i>Inventory</span><span class="mo-search">Search orders…</span><span class="mo-avatar">JR</span></div>
                <h4>Orders</h4>
                <div class="mo-cards" data-anim="rise" data-delay="0.08">
                  <div class="mo-card"><b>#4821</b><span>Harbor &amp; Bean</span><em>$1,240</em>${pill('Shipped', 'ok')}</div>
                  <div class="mo-card"><b>#4820</b><span>Blue Pine Dental</span><em>$860</em>${pill('Packing', 'wait')}</div>
                  <div class="mo-card"><b>#4819</b><span>Ridge Outfitters</span><em>$3,115</em>${pill('Shipped', 'ok')}</div>
                  <div class="mo-card"><b>#4818</b><span>Lakeside Studio</span><em>$420</em>${pill('On hold', 'hold')}</div>
                </div>
              </section>
            </div>
            <div class="mo-row">
              <section class="mo-panel mo-speed" data-stop="speed">
                <b class="mo-t">Page load time</b>
                <div class="mo-vs"><div><small>Before</small><b class="old">8.4 s</b></div><div class="mo-arrow">→</div><div><small>After</small><b class="new" data-anim="count" data-count="0.8" data-dec="1" data-suffix=" s">0.8 s</b></div></div>
                <div class="mo-meter"><i class="old"></i><i class="new" data-anim="fill" data-delay="0.1" data-dur="0.3"></i></div>
                <p>10× faster, same data, same workflows.</p>
              </section>
              <section class="mo-panel" data-stop="fixes">
                <b class="mo-t">Clean-up list</b>
                <ul class="checks big" data-anim="check" data-delay="0.08"><li>Crash on the Orders screen fixed</li><li>Outdated libraries updated</li><li>Sign-in moved to secure accounts</li><li>Automated tests added</li><li>Works on phones and tablets</li></ul>
              </section>
              <section class="mo-panel mo-phone-wrap" data-stop="mobile">
                <div class="mo-phone"><span class="mo-notch"></span><b>Orders</b><div class="mo-mcard">#4821 · Harbor &amp; Bean<em>$1,240</em></div><div class="mo-mcard">#4820 · Blue Pine<em>$860</em></div><div class="mo-mcard">#4819 · Ridge Outfitters<em>$3,115</em></div><span class="mo-mbtn">+ New order</span></div>
                <p>Now it works on the warehouse floor, too.</p>
              </section>
            </div>`,
  pops: '',
};

/* ---------- Replace spreadsheets: the sheet, then the app for a field-service company ---------- */
const sheet = {
  world: 'w-sheet',
  body: `
            <section class="sh-xls" data-stop="sheet">
              <div class="sh-xbar"><span class="sh-xicon">X</span>Jobs_FINAL_v3_REAL (2).xlsx<span class="sh-warn">3 people are editing · conflicts</span></div>
              <div class="sh-grid">
                <div class="sh-r h"><span></span><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div>
                <div class="sh-r"><span>1</span><span>Job</span><span>Client</span><span>Crew</span><span>Date</span><span>Price</span></div>
                <div class="sh-r"><span>2</span><span>Deep clean</span><span>Harbor &amp; Bean</span><span>Crew 2</span><span>5/12</span><span>$340</span></div>
                <div class="sh-r"><span>3</span><span>Windows</span><span>Blue Pine Dental</span><span class="bad">??</span><span>5/12</span><span class="bad">#REF!</span></div>
                <div class="sh-r"><span>4</span><span>Carpet</span><span>Ridge Outfitters</span><span>Crew 1</span><span class="bad">5/31/12</span><span>$520</span></div>
                <div class="sh-r"><span>5</span><span>Deep clean</span><span>harbor and bean</span><span>Crew 2</span><span>5/12</span><span class="bad">#VALUE!</span></div>
              </div>
              <div class="sh-tabs"><span>Jobs</span><span>Jobs (old)</span><span>DON'T TOUCH</span><span>Prices 2024</span><span>Sheet7</span></div>
            </section>
            <section class="sh-app" data-stop="jobs">
              <div class="sh-abar"><span class="sh-logo"><i></i>Brightway Jobs</span><span class="sh-week">Week of May 12</span><span class="sh-new">+ New job</span></div>
              <div class="sh-days">
                ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<small>${d}</small>`).join('')}
              </div>
              <div class="sh-cal" data-anim="rise" data-delay="0.08">
                <div class="sh-job c1" style="grid-column:1"><b>Deep clean</b><span>Harbor &amp; Bean · Crew 2</span></div>
                <div class="sh-job c2" style="grid-column:1"><b>Windows</b><span>Blue Pine Dental · Crew 3</span></div>
                <div class="sh-job c3" style="grid-column:2"><b>Carpet</b><span>Ridge Outfitters · Crew 1</span></div>
                <div class="sh-job c1" style="grid-column:3"><b>Office clean</b><span>Crest Auto · Crew 2</span></div>
                <div class="sh-job c2" style="grid-column:4"><b>Move-out</b><span>Lakeside Studio · Crew 1</span></div>
                <div class="sh-job c3" style="grid-column:5"><b>Deep clean</b><span>Harbor &amp; Bean · Crew 3</span></div>
              </div>
            </section>
            <div class="sh-row">
              <section class="sh-card sh-field" data-stop="field">
                <div class="sh-phone"><span class="sh-notch"></span><b>Job done: Deep clean</b><small>Harbor &amp; Bean</small>
                  <label>Hours<span class="sh-f" data-anim="type" data-fill="3.5"></span></label>
                  <label>Notes<span class="sh-f" data-anim="type" data-fill="Back room done, needs supplies"></span></label>
                  <div class="sh-photo">📷 2 photos</div>
                  <span class="sh-btn" data-anim="press" data-delay="0.36">Submit</span></div>
                <p>Crews log jobs from their phones. Nothing retyped that evening.</p>
              </section>
              <section class="sh-card" data-stop="report">
                <b class="sh-t">This week</b>
                <div class="sh-stats"><div><small>Jobs done</small><b data-anim="count" data-count="48">48</b></div><div><small>Revenue</small><b data-anim="count" data-count="16320" data-prefix="$">$16,320</b></div></div>
                <div class="bars sh-bars" data-anim="grow" data-delay="0.1">${bars([60, 78, 70, 92, 84])}</div>
                <div class="sh-days small">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<small>${d}</small>`).join('')}</div>
              </section>
              <section class="sh-card" data-stop="history">
                <b class="sh-t">Change history</b>
                <div class="sh-log" data-anim="rise" data-delay="0.08">
                  <p><i>MR</i><span><b>Maria</b> changed the price of Carpet · Ridge Outfitters from $480 to $520</span><em>2 min ago</em></p>
                  <p><i>DJ</i><span><b>Dev</b> moved Windows · Blue Pine to Crew 3</span><em>1 hour ago</em></p>
                  <p><i>AL</i><span><b>Alex</b> added Move-out · Lakeside Studio</span><em>Yesterday</em></p>
                </div>
              </section>
            </div>`,
  pops: `<div class="tour-toast tour-pop" data-at="field" data-delay="0.46" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Job marked done</b><span>Deep clean · Harbor &amp; Bean · invoice ready</span></div></div>`,
};

/* ---------- Secure your software: a security center ---------- */
const shield = {
  world: 'w-shield',
  body: `
            ${chrome('security.yourcompany.com', 'Sample dashboard')}
            <div class="se-top"><span class="se-logo"><i></i>Security center</span><span class="se-score">Security score <b data-anim="count" data-count="96" data-at="site">96</b>/100</span></div>
            <div class="se-row">
              <section class="se-card se-login" data-stop="login">
                <div class="se-lock">🔒</div>
                <b>Two-step sign-in</b>
                <p>Enter the 6-digit code from your authenticator app</p>
                <div class="se-code" data-anim="rise" data-delay="0.08">${'482913'.split('').map((d) => `<span>${d}</span>`).join('')}</div>
                <span class="se-btn" data-anim="press" data-delay="0.4">Verify</span>
                <p class="se-ok" data-anim="pop" data-delay="0.48">✓ Signed in securely</p>
              </section>
              <section class="se-card se-blocked" data-stop="blocked">
                <b class="se-t">Blocked this week</b>
                <b class="se-big" data-anim="count" data-count="1204">1,204</b>
                <small>suspicious sign-in attempts stopped</small>
                <div class="bars se-bars" data-anim="grow" data-delay="0.1">${bars([30, 64, 42, 88, 55, 38, 70])}</div>
                <div class="se-origins"><span>Password guessing</span><span>Bots</span><span>Unknown locations</span></div>
              </section>
            </div>
            <section class="se-card se-scan" data-stop="scan">
              <div class="se-head"><b class="se-t">Vulnerability scan</b><span class="se-bar"><i data-anim="fill" data-delay="0.04" data-dur="0.35"></i></span></div>
              <ul class="checks big dark se-checks" data-anim="check" data-delay="0.1"><li>Libraries up to date (0 known vulnerabilities)</li><li>Passwords hashed, never stored as text</li><li>All traffic encrypted (TLS 1.3)</li><li>Secrets kept out of the code</li><li>Backups encrypted and tested</li></ul>
            </section>
            <div class="se-row">
              <section class="se-card" data-stop="access">
                <b class="se-t">Who can see what</b>
                <div class="se-tbl">
                  <div class="se-tr th"><span></span><span>Orders</span><span>Payments</span><span>Payroll</span></div>
                  <div class="se-tr"><span>Owner</span><i class="y"></i><i class="y"></i><i class="y"></i></div>
                  <div class="se-tr"><span>Manager</span><i class="y"></i><i class="y"></i><i class="n"></i></div>
                  <div class="se-tr"><span>Staff</span><i class="y"></i><i class="n"></i><i class="n"></i></div>
                </div>
              </section>
              <section class="se-card" data-stop="audit">
                <b class="se-t">Audit log</b>
                <div class="se-log" data-anim="rise" data-delay="0.08">
                  <p><em>09:12</em><span>Maya exported the orders report</span></p>
                  <p><em>09:40</em><span>New device sign-in approved for Jordan</span></p>
                  <p class="warn"><em>10:03</em><span>Blocked sign-in from unknown location</span></p>
                  <p><em>10:21</em><span>Staff role updated: payments hidden</span></p>
                </div>
              </section>
            </div>`,
  pops: `<div class="tour-toast tour-pop se-alert" data-at="blocked" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Attack blocked</b><span>500 password guesses from one address · address banned</span></div></div>`,
};

/* ---------- Move to the cloud: a migration in progress ---------- */
const migrate = {
  world: 'w-migrate',
  body: `
            ${chrome('migration.yourcompany.com', 'Sample plan')}
            <div class="mg-hero" data-stop="map">
              <div class="mg-box old"><span class="mg-ico">🖥️</span><b>Office server</b><small>Closet, 7 years old</small></div>
              <div class="mg-path"><span class="mg-dot d1"></span><span class="mg-dot d2"></span><span class="mg-dot d3"></span></div>
              <div class="mg-box new"><span class="mg-ico">☁️</span><b>Your cloud account</b><small>Backed up, monitored, scalable</small></div>
            </div>
            <div class="mg-row">
              <section class="mg-card" data-stop="plan">
                <b class="mg-t">Migration plan</b>
                <ol class="checks big" data-anim="check" data-delay="0.08"><li>Inventory everything on the old server</li><li>Set up the new cloud account</li><li>Copy and verify the data</li><li>Test with your team</li><li>Switch over on Sunday night</li></ol>
              </section>
              <section class="mg-card mg-xfer" data-stop="transfer">
                <b class="mg-t">Copying your data</b>
                <b class="mg-pct" data-anim="count" data-count="100" data-suffix="%">100%</b>
                <div class="mg-prog"><i data-anim="fill" data-delay="0.06" data-dur="0.45"></i></div>
                <div class="mg-files"><span>Database · 180 GB</span><span>Files · 2.2 TB</span><span>Email archive · 40 GB</span></div>
                <p class="mg-verified" data-anim="pop" data-delay="0.55">✓ Every file checked against the original</p>
              </section>
            </div>
            <div class="mg-row">
              <section class="mg-card" data-stop="switch">
                <b class="mg-t">Switch-over night</b>
                <div class="mg-timeline" data-anim="rise" data-delay="0.08">
                  <p><em>11:00 PM</em>Final copy started</p><p><em>11:40 PM</em>New servers checked</p><p><em>11:52 PM</em>Traffic moved to the cloud</p><p><em>12:05 AM</em>Everything confirmed working</p>
                </div>
                <div class="mg-down">Downtime: <b>0 minutes</b></div>
              </section>
              <section class="mg-card mg-save" data-stop="savings">
                <b class="mg-t">After the move</b>
                <div class="mg-cmp"><div><small>Old server costs</small><b class="old">$1,150/mo</b></div><div><small>Cloud costs</small><b data-anim="count" data-count="640" data-prefix="$" data-suffix="/mo">$640/mo</b></div></div>
                <div class="mg-ups"><span>✓ Nightly backups</span><span>✓ 24/7 monitoring</span><span>✓ Scales when you grow</span></div>
              </section>
            </div>`,
  pops: `<div class="tour-toast tour-pop" data-at="switch" data-delay="0.45" aria-hidden="true"><span class="tour-toast-dot"></span><div><b>Migration complete</b><span>You're running in the cloud · zero downtime</span></div></div>`,
};

module.exports = { launch, modern, sheet, shield, migrate };
