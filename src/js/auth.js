/* =====================================================================
   Sign-in pages (login.html, signup.html, account.html).

   Two tiers: owner (the team dashboard) and client (their account page).
   Accounts are invite only: an owner invites an email from the dashboard,
   the invite link opens signup.html, and the database refuses any new
   account (password or Google) whose email has no open invite. Anyone can
   "request a spot" from the login page.
   ===================================================================== */
import { supabase, isConfigured } from './supabase.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const PAGE = document.body.dataset.page;
const BASE = new URL('./', location.href).href;          // works at a domain root or under /williams-systems-llc/
const GOOGLE_ON = import.meta.env.VITE_GOOGLE_AUTH === '1';

$$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });

/* ---------- helpers ---------- */
function show(id) {
  $$('.auth-card').forEach((c) => { c.hidden = c.id !== id; });
  // the first field to type in, or else the first button
  const first = $(`#${id} input:not([readonly])`) || $(`#${id} .btn`);
  if (first) first.focus({ preventScroll: true });
}
function say(form, text, ok = false) {
  const box = $('.auth-msg', form);
  box.textContent = text;
  box.className = `auth-msg ${ok ? 'ok' : 'err'}`;
  box.hidden = !text;
}
function busy(form, on, label) {
  const btn = $('button[type="submit"]', form);
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  btn.disabled = on;
}
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// what Supabase says, in plain words
function friendly(err) {
  const m = String(err?.message || err || '');
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/invite_required|database error saving new user/i.test(m)) return 'That email doesn’t have an invite yet. Request a spot and we’ll get back to you.';
  if (/already registered|already been registered/i.test(m)) return 'There’s already an account for this email. Sign in instead.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/password should be at least/i.test(m)) return 'Use a password with at least 8 characters.';
  return m || 'Something went wrong. Please try again.';
}

// Where someone goes once they're signed in: owners to the dashboard, clients to their account.
// ?next= can only name one of our own pages.
const SAFE_NEXT = ['admin.html', 'account.html'];
async function goHome() {
  const next = new URLSearchParams(location.search).get('next');
  const { data: role } = await supabase.rpc('my_role');
  if (next && SAFE_NEXT.includes(next) && !(next === 'admin.html' && role !== 'owner')) return location.assign(next);
  location.assign(role === 'owner' ? 'admin.html' : 'account.html');
}

function wireGoogle(redirectPage, form) {
  $$('[data-google]').forEach((e) => { e.hidden = !GOOGLE_ON; });
  const btn = $('button[data-google]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: BASE + redirectPage } });
    if (error) say(form, friendly(error));
  });
}

// errors that come back in the address after a Google or email-link round trip
function urlError() {
  const p = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  const d = p.get('error_description') || p.get('error');
  return d ? friendly(d.replace(/\+/g, ' ')) : '';
}

/* ---------- pages ---------- */
if (!isConfigured) show('notReady');
else if (PAGE === 'login') loginPage();
else if (PAGE === 'signup') signupPage();
else if (PAGE === 'account') accountPage();

/* login.html: sign in, forgot password, set a new one, request a spot */
async function loginPage() {
  const signInForm = $('#signInForm');
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  wireGoogle('login.html', signInForm);

  let recovering = false;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; show('reset'); }
  });

  const err = urlError();
  const { data: { session } } = await supabase.auth.getSession();
  if (recovering) return;
  if (session && !err) return goHome();
  show(location.hash === '#request' ? 'request' : 'signIn');
  if (err) say(signInForm, err);

  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = signInForm.email.value.trim(), password = signInForm.password.value;
    if (!validEmail(email) || !password) return say(signInForm, 'Enter your email and password.');
    say(signInForm, '');
    busy(signInForm, true, 'Signing in…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { busy(signInForm, false); return say(signInForm, friendly(error)); }
    goHome();
  });

  const forgotForm = $('#forgotForm');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = forgotForm.email.value.trim();
    if (!validEmail(email)) return say(forgotForm, 'Enter the email you sign in with.');
    busy(forgotForm, true, 'Sending…');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: BASE + 'login.html' });
    busy(forgotForm, false);
    // same answer whether or not the email has an account, so the form can't be used to look people up
    if (error && !/not found/i.test(error.message)) return say(forgotForm, friendly(error));
    say(forgotForm, 'If there’s an account for that email, a reset link is on its way.', true);
  });

  const resetForm = $('#resetForm');
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = resetForm.password.value;
    if (password.length < 8) return say(resetForm, 'Use a password with at least 8 characters.');
    if (password !== resetForm.confirm.value) return say(resetForm, 'The two passwords don’t match.');
    busy(resetForm, true, 'Saving…');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { busy(resetForm, false); return say(resetForm, friendly(error)); }
    goHome();
  });

  const requestForm = $('#requestForm');
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = requestForm;
    const row = { name: f.name.value.trim(), email: f.email.value.trim(), company: f.company.value.trim() || null, message: f.message.value.trim() || null };
    if (!row.name) return say(f, 'Tell us your name.');
    if (!validEmail(row.email)) return say(f, 'Enter an email we can reach you at.');
    busy(f, true, 'Sending…');
    const { error } = await supabase.from('access_requests').insert(row);
    busy(f, false);
    if (error) return say(f, friendly(error));
    show('requestSent');
  });
}

/* signup.html: accept an invite and create the account */
async function signupPage() {
  const token = new URLSearchParams(location.search).get('invite');
  const valid = token && /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valid ? await supabase.rpc('invite_for_token', { t: token }) : { data: null };
  const invite = data && data[0];
  if (!invite) return show('noInvite');

  const form = $('#createForm');
  form.email.value = invite.email;
  $('#inviteFor').textContent = invite.role === 'owner'
    ? `This invite gives ${invite.email} owner access to the team dashboard.`
    : `This invite is for your client account at ${invite.email}.`;
  wireGoogle('account.html', form);
  show('create');
  const err = urlError();
  if (err) say(form, err);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim(), password = form.password.value;
    if (!name) return say(form, 'Tell us your name.');
    if (password.length < 8) return say(form, 'Use a password with at least 8 characters.');
    if (password !== form.confirm.value) return say(form, 'The two passwords don’t match.');
    say(form, '');
    busy(form, true, 'Creating your account…');
    const { data: res, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: BASE + 'account.html' },
    });
    busy(form, false);
    if (error) return say(form, friendly(error));
    if (res.session) return goHome();
    $('#sentTo').textContent = invite.email;
    show('checkEmail');
  });
}

/* account.html: where a signed-in person lands */
async function accountPage() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return location.replace('login.html?next=account.html');
  const { data: me } = await supabase.from('profiles').select('full_name, role, email').eq('id', session.user.id).maybeSingle();
  const role = me?.role || 'client';
  const first = (me?.full_name || '').trim().split(/\s+/)[0];
  $('#tier').textContent = role === 'owner' ? 'Owner' : 'Client';
  $('#hello').textContent = first ? `Hi, ${first}.` : 'Hi there.';
  $('#whoami').textContent = `Signed in as ${me?.email || session.user.email}.`;
  $('#ownerLinks').hidden = role !== 'owner';
  $('#clientEmpty').hidden = role === 'owner';
  show('home');
  $('#signOut').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.assign('login.html');
  });
}
