/* =====================================================================
   Account settings — Profile, Security, Notifications, Customization,
   then Billing (clients) or Business (owners: payment defaults). One window with sections down the left.
   Preferences live on the profile (prefs), so they follow the account.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, toast, modal, field, initials, fmtDate, timeAgo } from './util.js';
import { billingView, loadBillingSettings, saveBillingSettings, syncStripe, HOLD_DAYS } from './billing.js';

/* ---------- preferences: apply anywhere ---------- */
export const ACCENTS = {
  blue:   { label: 'Blue',   a: '#007ACC', a2: '#1F9CF0', fg: '#3794FF' },
  purple: { label: 'Purple', a: '#7C5CFF', a2: '#9A7DFF', fg: '#A895FF' },
  green:  { label: 'Green',  a: '#15965F', a2: '#1FB374', fg: '#3DDC84' },
  orange: { label: 'Orange', a: '#D9661F', a2: '#F08134', fg: '#FFA564' },
  pink:   { label: 'Pink',   a: '#C23A94', a2: '#DB55AC', fg: '#F28ACD' },
};
export const DEFAULT_PREFS = { accent: 'blue', compact: false, reduceMotion: false, popups: true, chatBubble: true, emailAlerts: false };
export function applyPrefs(p = {}) {
  const prefs = { ...DEFAULT_PREFS, ...p };
  window.wsPrefs = prefs;
  const root = document.documentElement;
  const ac = ACCENTS[prefs.accent] || ACCENTS.blue;
  if (prefs.accent && prefs.accent !== 'blue') {
    root.style.setProperty('--accent', ac.a);
    root.style.setProperty('--accent-2', ac.a2);
    root.style.setProperty('--accent-fg', ac.fg);
    root.style.setProperty('--accent-soft', `${ac.a}1F`);
    root.style.setProperty('--accent-line', `${ac.a}52`);
  } else ['--accent', '--accent-2', '--accent-fg', '--accent-soft', '--accent-line'].forEach((v) => root.style.removeProperty(v));
  root.classList.toggle('compact', Boolean(prefs.compact));
  root.classList.toggle('reduce-motion', Boolean(prefs.reduceMotion));
  gsap.globalTimeline.timeScale(prefs.reduceMotion ? 1000 : 1);
  document.body.classList.toggle('no-chat-bubble', prefs.chatBubble === false);
  return prefs;
}

const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SECTIONS = [
  ['profile', 'Profile', I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')],
  ['security', 'Password & security', I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')],
  ['notifications', 'Notifications', I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')],
  ['customize', 'Customization', I('<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a6 6 0 0 0 6-6c0-4.9-4.5-8.9-10-8.9z"/>')],
  ['billing', 'Billing & payments', I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'), 'client'],
  ['business', 'Business', I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'), 'owner'],
];

/**
 * Open the settings window.
 * ctx: { me (auth user), owner, profile: { full_name, email, phone, company, prefs }, section?, onProfile? }
 */
export function openSettings(ctx) {
  const { me, owner } = ctx;
  const prof = { ...ctx.profile, prefs: { ...DEFAULT_PREFS, ...(ctx.profile?.prefs || {}) } };
  const sections = SECTIONS.filter(([, , , who]) => !who || who === (owner ? 'owner' : 'client'));
  let current = sections.some(([k]) => k === ctx.section) ? ctx.section : ctx.section === 'billing' && owner ? 'business' : 'profile';
  let billView = null;
  const nav = el('nav', { class: 'st-nav', 'aria-label': 'Settings sections' });
  const pane = el('div', { class: 'st-pane' });
  const shell = el('div', { class: 'st' }, nav, pane);
  const m = modal('Account settings', shell, { wide: true, onClose: () => billView?.destroy() });
  m.root.querySelector('.crm-modal-card').classList.add('st-card');

  const saveProfile = async (patch, msg) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', me.id);
    if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return false; }
    Object.assign(prof, patch);
    if (patch.prefs) applyPrefs(prof.prefs);
    ctx.onProfile?.(prof);
    if (msg) toast(msg);
    return true;
  };
  const setPref = (k, v, msg) => { prof.prefs = { ...prof.prefs, [k]: v }; applyPrefs(prof.prefs); return saveProfile({ prefs: prof.prefs }, msg); };

  function go(key) {
    current = key;
    billView?.destroy(); billView = null;
    fill(nav, sections.map(([k, label, svg]) => el('button', { type: 'button', class: 'st-tab', 'aria-current': k === current ? 'page' : 'false', onclick: () => go(k) },
      el('span', { class: 'st-tab-ico', html: svg }), el('span', { text: label }))));
    const section = { profile, security, notifications, customize, billing, business }[key];
    fill(pane, section());
    pane.scrollTop = 0;
  }
  const head = (title, sub) => el('header', { class: 'st-head' }, el('h3', { text: title }), sub ? el('p', { text: sub }) : null);
  const row = (label, hint, control) => el('div', { class: 'st-row' }, el('div', { class: 'st-row-text' }, el('strong', { text: label }), hint ? el('small', { text: hint }) : null), control);
  const toggle = (on, onChange, label) => {
    const b = el('button', { type: 'button', role: 'switch', class: 'st-switch', 'aria-checked': String(Boolean(on)), 'aria-label': label });
    b.addEventListener('click', () => { const next = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(next)); onChange(next); });
    return b;
  };

  /* ---------- Profile ---------- */
  function profile() {
    const name = el('input', { maxlength: 120, value: prof.full_name || '', autocomplete: 'name' });
    const phone = el('input', { maxlength: 40, value: prof.phone || '', autocomplete: 'tel', inputmode: 'tel' });
    const company = el('input', { maxlength: 160, value: prof.company || '', autocomplete: 'organization' });
    const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
    const f = el('form', { class: 'crm-form', novalidate: true },
      el('div', { class: 'st-id' }, el('span', { class: 'acct-av big', text: initials(prof.full_name || prof.email) }),
        el('div', {}, el('strong', { text: prof.full_name || 'Your account' }), el('small', { text: prof.email }), el('span', { class: 'acct-role', text: owner ? 'Owner' : 'Client' }))),
      field('Display name', name, owner ? 'Shown to clients in chats, tickets and invoices' : 'Shown to Landon in chats and requests'),
      el('div', { class: 'crm-form-row' }, field('Phone', phone), field(owner ? 'Business name' : 'Company', company)),
      field('Email', el('input', { value: prof.email || me.email, disabled: true }), owner ? 'Your sign-in email.' : 'Your sign-in email. Ask Landon if it needs to change.'),
      msg,
      el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save profile' })));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { msg.textContent = 'Add a display name.'; msg.hidden = false; return; }
      if (await saveProfile({ full_name: name.value.trim(), phone: phone.value.trim() || null, company: company.value.trim() || null }, 'Profile saved')) go('profile');
    });
    return [head('Profile', 'How you appear across the dashboard and portal.'), f];
  }

  /* ---------- Security ---------- */
  function security() {
    const pass = el('input', { type: 'password', autocomplete: 'new-password', minlength: 8 });
    const pass2 = el('input', { type: 'password', autocomplete: 'new-password', minlength: 8 });
    const meter = el('div', { class: 'st-meter' }, el('i'), el('i'), el('i'), el('i'));
    const meterText = el('small', { class: 'st-meter-text' });
    pass.addEventListener('input', () => {
      const v = pass.value;
      const score = !v ? 0 : [v.length >= 8, v.length >= 12, /[A-Z]/.test(v) && /[a-z]/.test(v), /\d/.test(v) && /[^\w\s]/.test(v)].filter(Boolean).length;
      meter.dataset.score = score;
      meterText.textContent = !v ? '' : ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][score];
    });
    const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
    const f = el('form', { class: 'crm-form', novalidate: true },
      el('div', { class: 'crm-form-row' }, field('New password', pass), field('Confirm new password', pass2)),
      el('div', { class: 'st-meter-row' }, meter, meterText),
      msg,
      el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: 'Update password' })));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const say = (t) => { msg.textContent = t; msg.hidden = !t; };
      if (pass.value.length < 8) return say('Use at least 8 characters.');
      if (pass.value !== pass2.value) return say('The two passwords don’t match.');
      const { error } = await supabase.auth.updateUser({ password: pass.value });
      if (error) return say(/should be different/i.test(error.message) ? 'That’s already your password.' : error.message);
      pass.value = ''; pass2.value = ''; say(''); meter.dataset.score = 0; meterText.textContent = '';
      toast('Password updated');
    });
    let armed = false;
    const everywhere = el('button', { type: 'button', class: 'btn btn-ghost btn-sm danger', text: 'Sign out everywhere' });
    everywhere.addEventListener('click', async () => {
      if (!armed) { armed = true; everywhere.textContent = 'Click again to confirm'; setTimeout(() => { armed = false; everywhere.textContent = 'Sign out everywhere'; }, 4000); return; }
      await supabase.auth.signOut({ scope: 'global' });
      location.assign('login.html');
    });
    return [
      head('Password & security', 'Keep your account safe.'),
      el('section', { class: 'st-block' }, el('h4', { text: 'Change password' }), f),
      el('section', { class: 'st-block' }, el('h4', { text: 'Sessions' }),
        row('Last sign-in', me.last_sign_in_at ? `${fmtDate(me.last_sign_in_at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} (${timeAgo(me.last_sign_in_at)})` : 'This session', null),
        row('Sign out of every device', 'Ends every session on phones, tablets and other browsers, including this one.', everywhere)),
    ];
  }

  /* ---------- Notifications ---------- */
  function notifications() {
    const p = prof.prefs;
    return [
      head('Notifications', 'Choose what gets your attention.'),
      el('section', { class: 'st-block' },
        row('Pop-up alerts', 'A short message in the corner when something new arrives. The bell always keeps a list.', toggle(p.popups, (v) => setPref('popups', v, v ? 'Pop-ups on' : 'Pop-ups off'), 'Pop-up alerts')),
        row('Messages button', 'The round messages button in the corner. The Message buttons still open your messages.', toggle(p.chatBubble, (v) => setPref('chatBubble', v, v ? 'Chat bubble on' : 'Chat bubble hidden'), 'Chat bubble')),
        row('Email me about new activity', 'Saved for when email alerts are switched on for the site; nothing is emailed yet.', toggle(p.emailAlerts, (v) => setPref('emailAlerts', v, 'Saved'), 'Email alerts'))),
    ];
  }

  /* ---------- Customization ---------- */
  function customize() {
    const p = prof.prefs;
    const swatches = el('div', { class: 'st-swatches', role: 'radiogroup', 'aria-label': 'Accent colour' },
      Object.entries(ACCENTS).map(([k, v]) => el('button', { type: 'button', role: 'radio', class: 'st-swatch', 'aria-checked': String(p.accent === k), title: v.label, 'aria-label': v.label, style: { '--sw': v.a },
        onclick: async () => { await setPref('accent', k, `${v.label} accent`); go('customize'); } })));
    return [
      head('Customization', 'Make the dashboard feel like yours. Changes apply straight away and follow your account.'),
      el('section', { class: 'st-block' },
        row('Accent colour', 'Buttons, highlights and links.', swatches),
        row('Compact mode', 'Tighter spacing so more fits on screen.', toggle(p.compact, (v) => setPref('compact', v, v ? 'Compact mode on' : 'Compact mode off'), 'Compact mode')),
        row('Reduce motion', 'Turns off animations and transitions.', toggle(p.reduceMotion, (v) => setPref('reduceMotion', v, v ? 'Motion reduced' : 'Motion on'), 'Reduce motion'))),
    ];
  }

  /* ---------- Billing & payments (clients): every project's bills ---------- */
  function billing() {
    const box = el('div', { class: 'st-billing' }, el('p', { class: 'cv-loading', text: 'Loading billing…' }));
    supabase.from('contracts').select('*').neq('status', 'lost').then(({ data }) => {
      if (current !== 'billing') return;
      if (!(data || []).length) { fill(box, el('p', { class: 'st-muted', text: 'No projects yet, so nothing to bill.' })); return; }
      billView = billingView(box, { contracts: data, owner: false });
    });
    return [head('Billing & payments', 'What’s due, what’s coming up and how to pay, across all your projects.'), box];
  }

  /* ---------- Stripe: paste the secret key once; it's kept encrypted in the database ---------- */
  function stripeBlock(d) {
    const box = el('div', { class: 'st-stripe' });
    const draw = (info) => {
      if (info?.connected) {
        fill(box, row('Stripe', `Connected to ${info.account || 'your account'}. Every bill you send gets its own payment link for its exact amount, and paid bills mark themselves paid within a minute.`,
          el('span', { class: `st-chip ${info.mode === 'test' ? 'test' : 'on'}`, text: info.mode === 'test' ? 'Test mode' : 'Live' })),
        el('div', { class: 'st-stripe-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Check for payments now', onclick: async (e) => { e.currentTarget.disabled = true; const n = await syncStripe(); toast(n ? `${n} bill${n === 1 ? '' : 's'} marked paid` : 'No new payments'); e.currentTarget.disabled = false; } }),
          el('button', { type: 'button', class: 'link-btn', text: info.mode === 'test' ? 'Switch to live key' : 'Replace key', onclick: () => draw(null) }),
          el('button', { type: 'button', class: 'link-btn danger', text: 'Disconnect', onclick: async () => {
            if (!confirm('Disconnect Stripe? Bills keep the links they have; new bills won’t get one.')) return;
            const { error } = await supabase.rpc('disconnect_stripe');
            if (error) return toast(error.message, 'error');
            toast('Stripe disconnected'); draw(null);
          } })));
        return;
      }
      const key = el('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk_test_… or sk_live_…', 'aria-label': 'Stripe secret key' });
      const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
      const go = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Connect Stripe', onclick: async () => {
        msg.hidden = true;
        if (!key.value.trim()) { msg.textContent = 'Paste your secret key first.'; msg.hidden = false; return; }
        go.disabled = true; go.textContent = 'Checking with Stripe…';
        const { data, error } = await supabase.rpc('set_stripe_key', { k: key.value });
        go.disabled = false; go.textContent = 'Connect Stripe';
        if (error) { msg.textContent = error.message.replace(/^Stripe: /, 'Stripe said: '); msg.hidden = false; return; }
        key.value = '';
        toast(`Stripe connected (${data.mode === 'test' ? 'test mode' : 'live'})`);
        draw(data);
      } });
      fill(box,
        row('Stripe', 'Paste your Stripe secret key to connect. Every bill you send then gets its own payment link, and paid bills mark themselves paid. The key is stored encrypted and never shown again.', el('span', { class: 'st-chip', text: 'Not connected' })),
        el('div', { class: 'st-stripe-connect' }, key, go),
        el('p', { class: 'st-muted', text: 'Stripe → Developers → API keys → Secret key. Use the test key (sk_test_) first to try it with test cards, then connect the live key.' }),
        msg);
    };
    draw(d.stripe);
    return box;
  }

  /* ---------- Business (owners): invoice defaults and payments ---------- */
  function business() {
    const box = el('div', {}, el('p', { class: 'cv-loading', text: 'Loading…' }));
    loadBillingSettings().then((d) => {
      // carry over the defaults that used to live on the owner's profile
      const payLink = el('input', { type: 'url', maxlength: 500, placeholder: 'https://buy.stripe.com/…', value: d.payLink || prof.prefs.defaultPayLink || '' });
      const dueDays = el('input', { type: 'number', min: 0, max: 120, step: 1, inputmode: 'numeric', value: d.dueDays ?? 14 });
      const note = el('textarea', { rows: 2, maxlength: 500, placeholder: 'e.g. Thank you for your business!' });
      note.value = d.invoiceNote || prof.prefs.invoiceNote || '';
      const portal = el('input', { type: 'url', maxlength: 500, placeholder: 'https://billing.stripe.com/p/login/…', value: d.portalLink || '' });
      const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
      const f = el('form', { class: 'crm-form', novalidate: true },
        el('section', { class: 'st-block' }, el('h4', { text: 'Invoice defaults' }),
          el('p', { class: 'st-muted', text: 'Filled in on every new invoice. You can still change them per invoice.' }),
          field('Default payment link', payLink, 'Where clients pay, e.g. a Stripe payment link'),
          el('div', { class: 'crm-form-row' }, field('Due after (days)', dueDays), el('span')),
          field('Default note', note)),
        el('section', { class: 'st-block' }, el('h4', { text: 'Client payment method' }),
          el('p', { class: 'st-muted', text: 'A link where clients save or change the card they pay with, such as your Stripe customer portal. It shows on their Billing page. Cards are never stored on this site.' }),
          field('Payment method link', portal)),
        msg,
        el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save' })));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const say = (t) => { msg.textContent = t; msg.hidden = !t; };
        const links = [payLink, portal].map((i) => i.value.trim());
        if (links.some((l) => l && !/^https:\/\//i.test(l))) return say('Links should start with https://');
        say('');
        if (await saveBillingSettings({ payLink: links[0], portalLink: links[1], invoiceNote: note.value.trim(), dueDays: Math.max(0, Math.min(120, Number(dueDays.value) || 0)) })) toast('Business settings saved');
      });
      fill(box,
        el('section', { class: 'st-block' }, el('h4', { text: 'Payments' }),
          stripeBlock(d),
          row('Account hold', `A bill more than ${HOLD_DAYS} days past due puts that client on hold: no new tickets or meeting requests until it’s paid.`, el('span', { class: 'st-chip on', text: 'On' })),
          row('Invoices and money', 'Bills, who owes what, expenses and profit.', el('a', { class: 'btn btn-ghost btn-sm', href: '#finances', onclick: () => m.close(), text: 'Open Finances' }))),
        f);
    });
    return [head('Business', 'How you bill clients.'), box];
  }

  go(current);
  return m;
}

