/* Sign-in pages: login.html, signup.html (accept an invite) and account.html.
   Takes the brand defs and logo mark from admin.html so the logo matches the site.
   Behaviour lives in src/js/auth.js; styles in src/styles/auth.css.
   Usage: node scripts/build-auth-pages.cjs */
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..') + '/';
const admin = fs.readFileSync(R + 'admin.html', 'utf8');
const defs = admin.match(/<svg class="brand-defs"[\s\S]*?<\/svg>/)[0];
const mark = admin.match(/<span class="brand-mark"[\s\S]*?<\/span>/)[0];

const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';

const page = (name, title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} — Williams Systems LLC</title>
  <meta name="theme-color" content="#0B0C10" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/styles/main.css" />
  <link rel="stylesheet" href="/src/styles/auth.css" />
</head>
<body class="auth" data-page="${name}">
  ${defs}
  <header class="auth-top">
    <a href="./" class="brand" aria-label="Williams Systems home">${mark}<span class="brand-name">Williams<span class="brand-thin"> Systems</span></span></a>
    <a class="auth-back" href="./">← Back to website</a>
  </header>

  <main class="auth-main">
${body}
  </main>

  <p class="auth-credit">© <span data-year></span> Williams Systems LLC · Built by Williams Systems LLC.</p>
  <script type="module" src="/src/js/auth.js"></script>
</body>
</html>
`;

// Shown on every page until the site is connected to its Supabase project
const notReady = `    <section class="auth-card" id="notReady" hidden>
      <p class="auth-kicker mono">Almost ready</p>
      <h1>Sign-in is on its way.</h1>
      <p>Client and owner accounts are being switched on. In the meantime, reach us any time.</p>
      <a class="btn btn-primary" href="contact.html">Contact us</a>
    </section>`;

const google = (label) => `        <button type="button" class="btn btn-google" data-google hidden>${GOOGLE}${label}</button>
        <p class="auth-or" data-google hidden>or</p>`;

/* ---------- login.html ---------- */
const login = `${notReady}

    <!-- Sign in -->
    <section class="auth-card" id="signIn" hidden>
      <p class="auth-kicker mono">Client &amp; owner login</p>
      <h1>Welcome back.</h1>
${google('Continue with Google')}
      <form id="signInForm" novalidate>
        <label class="auth-field"><span>Email</span><input type="email" name="email" autocomplete="username" required /></label>
        <label class="auth-field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required /></label>
        <div class="auth-row"><span></span><button type="button" class="auth-link" data-go="forgot">Forgot password?</button></div>
        <p class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Sign in</button>
      </form>
      <p class="auth-foot">New here? Accounts are by invite. <button type="button" class="auth-link" data-go="request">Request a spot</button></p>
    </section>

    <!-- Forgot password -->
    <section class="auth-card" id="forgot" hidden>
      <p class="auth-kicker mono">Reset your password</p>
      <h1>Forgot it? No problem.</h1>
      <p>Enter your email and we’ll send you a link to set a new password.</p>
      <form id="forgotForm" novalidate>
        <label class="auth-field"><span>Email</span><input type="email" name="email" autocomplete="username" required /></label>
        <p class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Send the link</button>
      </form>
      <p class="auth-foot"><button type="button" class="auth-link" data-go="signIn">← Back to sign in</button></p>
    </section>

    <!-- Set a new password (arrived from the reset email) -->
    <section class="auth-card" id="reset" hidden>
      <p class="auth-kicker mono">Reset your password</p>
      <h1>Choose a new password.</h1>
      <form id="resetForm" novalidate>
        <label class="auth-field"><span>New password</span><input type="password" name="password" autocomplete="new-password" minlength="8" required /></label>
        <label class="auth-field"><span>Type it again</span><input type="password" name="confirm" autocomplete="new-password" minlength="8" required /></label>
        <p class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Save and sign in</button>
      </form>
    </section>

    <!-- Request a spot -->
    <section class="auth-card" id="request" hidden>
      <p class="auth-kicker mono">Request a spot</p>
      <h1>Want an account?</h1>
      <p>Accounts are by invite. Tell us a little about you and we’ll get back to you within 24 hours.</p>
      <form id="requestForm" novalidate>
        <label class="auth-field"><span>Your name</span><input type="text" name="name" autocomplete="name" maxlength="120" required /></label>
        <label class="auth-field"><span>Email</span><input type="email" name="email" autocomplete="email" maxlength="200" required /></label>
        <label class="auth-field"><span>Business <small>(optional)</small></span><input type="text" name="company" autocomplete="organization" maxlength="160" /></label>
        <label class="auth-field"><span>What are you working on? <small>(optional)</small></span><textarea name="message" maxlength="2000"></textarea></label>
        <p class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Request a spot</button>
      </form>
      <p class="auth-foot">Already invited? <button type="button" class="auth-link" data-go="signIn">Sign in</button></p>
    </section>

    <!-- Request sent -->
    <section class="auth-card" id="requestSent" hidden>
      <p class="auth-kicker mono">Request sent</p>
      <h1>Thanks, we’ve got it.</h1>
      <p>We’ll reply within 24 hours. If it’s a fit, you’ll get an invite link to create your account.</p>
      <a class="btn btn-ghost" href="./">Back to the website</a>
    </section>`;

/* ---------- signup.html ---------- */
const signup = `${notReady}

    <!-- No (or a used) invite -->
    <section class="auth-card" id="noInvite" hidden>
      <p class="auth-kicker mono">Invite only</p>
      <h1>This invite link isn’t valid.</h1>
      <p>It may have been used already. If you already made your account, sign in. Otherwise, ask us for a new invite.</p>
      <a class="btn btn-primary" href="login.html">Sign in</a>
      <a class="btn btn-ghost" href="login.html#request">Request a spot</a>
    </section>

    <!-- Create the account -->
    <section class="auth-card" id="create" hidden>
      <p class="auth-kicker mono">You’re invited</p>
      <h1>Create your account.</h1>
      <p id="inviteFor"></p>
${google('Sign up with Google')}
      <form id="createForm" novalidate>
        <label class="auth-field"><span>Email</span><input type="email" name="email" autocomplete="username" readonly /></label>
        <label class="auth-field"><span>Your name</span><input type="text" name="name" autocomplete="name" maxlength="120" required /></label>
        <label class="auth-field"><span>Password <small>(8+ characters)</small></span><input type="password" name="password" autocomplete="new-password" minlength="8" required /></label>
        <label class="auth-field"><span>Type it again</span><input type="password" name="confirm" autocomplete="new-password" minlength="8" required /></label>
        <p class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Create account</button>
      </form>
      <p class="auth-note">Using Google? Choose the Google account for the email above.</p>
    </section>

    <!-- Confirm your email -->
    <section class="auth-card" id="checkEmail" hidden>
      <p class="auth-kicker mono">One more step</p>
      <h1>Check your email.</h1>
      <p>We sent a confirmation link to <b id="sentTo"></b>. Open it to finish creating your account.</p>
      <a class="btn btn-ghost" href="login.html">Go to sign in</a>
    </section>`;

/* ---------- account.html ---------- */
const account = `${notReady}

    <section class="auth-card" id="home" hidden>
      <span class="auth-badge" id="tier"></span>
      <h1 id="hello">Hi.</h1>
      <p id="whoami"></p>
      <ul class="auth-list" id="ownerLinks" hidden>
        <li><a href="admin.html">Team dashboard <span>→</span></a></li>
        <li><a href="admin.html#access">Invites and requests <span>→</span></a></li>
      </ul>
      <p class="auth-empty" id="clientEmpty" hidden>Your projects will show up here once we start working together.</p>
      <button type="button" class="btn btn-ghost" id="signOut">Sign out</button>
    </section>`;

for (const [file, title, body] of [
  ['login', 'Sign in', login],
  ['signup', 'Create your account', signup],
  ['account', 'Your account', account],
]) {
  fs.writeFileSync(R + file + '.html', page(file, title, body));
  console.log(file + '.html written');
}
