/* =====================================================================
   Account settings — Profile, Security, Notifications, Customization,
   Billing & payments. One window with sections down the left.
   Preferences live on the profile (prefs), so they follow the account.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, toast, modal, field, initials, money, fmtDate, timeAgo } from './util.js';

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
  ['billing', 'Billing & payments', I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>')],
];

/**
 * Open the settings window.
 * ctx: { me (auth user), owner, profile: { full_name, email, phone, company, prefs }, section?, onProfile? }
 */
export function openSettings(ctx) {
  const { me, owner } = ctx;
  const prof = { ...ctx.profile, prefs: { ...DEFAULT_PREFS, ...(ctx.profile?.prefs || {}) } };
  let current = ctx.section || 'profile';
  const nav = el('nav', { class: 'st-nav', 'aria-label': 'Settings sections' });
  const pane = el('div', { class: 'st-pane' });
  const shell = el('div', { class: 'st' }, nav, pane);
  const m = modal('Account settings', shell, { wide: true });
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
    fill(nav, SECTIONS.map(([k, label, svg]) => el('button', { type: 'button', class: 'st-tab', 'aria-current': k === current ? 'page' : 'false', onclick: () => go(k) },
      el('span', { class: 'st-tab-ico', html: svg }), el('span', { text: label }))));
    const section = { profile, security, notifications, customize, billing }[key];
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
        row('Chat bubble', 'The round chat button on project pages. The Message buttons still open the chat.', toggle(p.chatBubble, (v) => setPref('chatBubble', v, v ? 'Chat bubble on' : 'Chat bubble hidden'), 'Chat bubble')),
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

  /* ---------- Billing & payments ---------- */
  function billing() {
    const box = el('div', { class: 'st-billing' }, el('p', { class: 'cv-loading', text: 'Loading billing…' }));
    (owner ? ownerBilling : clientBilling)(box);
    return [head('Billing & payments', owner ? 'Invoice your clients and track what’s been paid.' : 'Your plans, invoices and how to pay.'), box];
  }

  const STATUS = { draft: 'Draft', sent: 'Due', paid: 'Paid', void: 'Void' };
  const invStatus = (i) => {
    const overdue = i.status === 'sent' && i.due_date && new Date(i.due_date + 'T23:59:59') < new Date();
    return el('span', { class: `inv-st inv-${overdue ? 'overdue' : i.status}`, text: overdue ? 'Overdue' : owner && i.status === 'sent' ? 'Sent' : STATUS[i.status] });
  };

  async function clientBilling(box) {
    const [{ data: contracts }, { data: invoices }] = await Promise.all([
      supabase.from('contracts').select('id, title, value, billing, status, start_date').neq('status', 'lost'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    ]);
    const cs = contracts || [], inv = invoices || [];
    const due = inv.filter((i) => i.status === 'sent').reduce((n, i) => n + Number(i.amount), 0);
    const paid = inv.filter((i) => i.status === 'paid').reduce((n, i) => n + Number(i.amount), 0);
    fill(box,
      el('div', { class: 'st-stats' },
        el('div', {}, el('small', { text: 'Outstanding' }), el('b', { text: money(due) })),
        el('div', {}, el('small', { text: 'Paid to date' }), el('b', { text: money(paid) })),
        el('div', {}, el('small', { text: 'Invoices' }), el('b', { text: String(inv.length) }))),
      el('section', { class: 'st-block' }, el('h4', { text: 'Your plans' }),
        cs.length ? el('ul', { class: 'st-plans' }, cs.map((c) => el('li', {},
          el('div', {}, el('strong', { text: c.title }), el('small', { text: c.billing === 'monthly' ? 'Monthly plan' : 'One-time project' })),
          el('b', { class: 'mono', text: `${money(c.value)}${c.billing === 'monthly' ? '/mo' : ''}` }))))
          : el('p', { class: 'st-muted', text: 'No plans yet.' })),
      el('section', { class: 'st-block' }, el('h4', { text: 'Invoices' }),
        inv.length ? el('ul', { class: 'inv-list' }, inv.map((i) => el('li', { class: 'inv' },
          el('div', { class: 'inv-main' },
            el('strong', { text: i.title }),
            el('small', { text: [`#${i.number}`, cs.find((c) => c.id === i.contract_id)?.title, i.due_date && i.status !== 'paid' ? `due ${fmtDate(i.due_date, { month: 'short', day: 'numeric' })}` : null, i.paid_at ? `paid ${fmtDate(i.paid_at, { month: 'short', day: 'numeric' })}` : null].filter(Boolean).join(' · ') }),
            i.note ? el('p', { class: 'inv-note', text: i.note }) : null),
          el('b', { class: 'inv-amt mono', text: money(i.amount) }),
          invStatus(i),
          i.status === 'sent' && i.pay_link ? el('a', { class: 'btn btn-primary btn-sm', href: i.pay_link, target: '_blank', rel: 'noopener noreferrer', text: 'Pay now' }) : el('span'))))
          : el('p', { class: 'st-muted', text: 'No invoices yet. When Landon sends one, it shows up here and you’ll get a notification.' })),
      el('section', { class: 'st-block st-note' }, el('h4', { text: 'Payment methods' }),
        el('p', { text: 'Each invoice has its own secure payment link. Card details are entered on the payment provider’s page, never stored here. Questions about a bill? Message Landon from your project.' })));
  }

  async function ownerBilling(box) {
    const [{ data: contracts }, { data: invoices }] = await Promise.all([
      supabase.from('contracts').select('id, title, value, billing, status, company, client_name').neq('status', 'lost').order('title'),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    ]);
    const cs = contracts || [], inv = invoices || [];
    const nameOf = (id) => cs.find((c) => c.id === id)?.title || 'Project';
    const sum = (st) => inv.filter((i) => i.status === st).reduce((n, i) => n + Number(i.amount), 0);
    const payLink = el('input', { type: 'url', maxlength: 500, placeholder: 'https://buy.stripe.com/…  ·  PayPal  ·  Venmo', value: prof.prefs.defaultPayLink || '' });
    const payNote = el('textarea', { rows: 2, maxlength: 500, placeholder: 'e.g. Payment due within 14 days. Thank you for your business!' });
    payNote.value = prof.prefs.invoiceNote || '';
    const saveDefaults = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Save defaults', onclick: async () => {
      if (payLink.value.trim() && !/^https:\/\//i.test(payLink.value.trim())) return toast('The payment link should start with https://', 'error');
      prof.prefs = { ...prof.prefs, defaultPayLink: payLink.value.trim() || null, invoiceNote: payNote.value.trim() || null };
      await saveProfile({ prefs: prof.prefs }, 'Payment defaults saved');
    } });
    const reload = () => ownerBilling(box);
    const act = async (i, patch, msg) => {
      const { error } = await supabase.from('invoices').update(patch).eq('id', i.id);
      if (error) return toast(`Couldn’t save: ${error.message}`, 'error');
      toast(msg); reload();
    };
    fill(box,
      el('div', { class: 'st-stats' },
        el('div', {}, el('small', { text: 'Outstanding' }), el('b', { text: money(sum('sent')) })),
        el('div', {}, el('small', { text: 'Paid' }), el('b', { text: money(sum('paid')) })),
        el('div', {}, el('small', { text: 'Drafts' }), el('b', { text: String(inv.filter((i) => i.status === 'draft').length) }))),
      el('section', { class: 'st-block' },
        el('div', { class: 'st-block-head' }, el('h4', { text: 'Invoices' }),
          cs.length ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '+ New invoice', onclick: () => invoiceForm(null, cs, prof.prefs, reload) }) : null),
        inv.length ? el('ul', { class: 'inv-list' }, inv.map((i) => el('li', { class: 'inv' },
          el('div', { class: 'inv-main' },
            el('strong', { text: i.title }),
            el('small', { text: [`#${i.number}`, nameOf(i.contract_id), i.due_date ? `due ${fmtDate(i.due_date, { month: 'short', day: 'numeric' })}` : null, i.paid_at ? `paid ${fmtDate(i.paid_at, { month: 'short', day: 'numeric' })}` : null].filter(Boolean).join(' · ') })),
          el('b', { class: 'inv-amt mono', text: money(i.amount) }),
          invStatus(i),
          el('span', { class: 'inv-actions' },
            i.status === 'draft' ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Send', onclick: () => act(i, { status: 'sent' }, 'Sent. The client was notified.') }) : null,
            i.status === 'sent' ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Mark paid', onclick: () => act(i, { status: 'paid' }, 'Marked paid') }) : null,
            el('button', { type: 'button', class: 'link-btn', text: 'Edit', onclick: () => invoiceForm(i, cs, prof.prefs, reload) })))))
          : el('p', { class: 'st-muted', text: cs.length ? 'No invoices yet. Create one and send it: the client gets a notification with a Pay now button.' : 'Invoices belong to a project. Create a contract first.' })),
      el('section', { class: 'st-block' }, el('h4', { text: 'Payment defaults' }),
        el('p', { class: 'st-muted', text: 'Pre-filled on every new invoice. Use a payment link from Stripe, PayPal, Square or Venmo; card details are entered there, never stored here.' }),
        field('Default payment link', payLink), field('Default note on invoices', payNote),
        el('div', { class: 'crm-form-actions' }, saveDefaults)));
  }

  go(current);
  return m;
}

/* ---------- create / edit an invoice (owners) ---------- */
function invoiceForm(inv, contracts, prefs, onSaved) {
  const isNew = !inv;
  const f = el('form', { class: 'crm-form', novalidate: true });
  const proj = el('select', {}, contracts.map((c) => el('option', { value: c.id, text: `${c.title}${c.company ? ` · ${c.company}` : ''}`, selected: inv?.contract_id === c.id ? true : null })));
  const title = el('input', { maxlength: 160, value: inv?.title || '' , placeholder: 'e.g. Website build · first half' });
  const amount = el('input', { type: 'number', min: 0, step: 50, inputmode: 'decimal', value: inv ? inv.amount : '' });
  const due = el('input', { type: 'date', value: inv?.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
  const link = el('input', { type: 'url', maxlength: 500, value: inv?.pay_link ?? prefs.defaultPayLink ?? '', placeholder: 'https://…' });
  const note = el('textarea', { rows: 2, maxlength: 2000 });
  note.value = inv?.note ?? prefs.invoiceNote ?? '';
  const fillFromProject = () => {
    const c = contracts.find((x) => x.id === proj.value);
    if (!c || !isNew) return;
    if (!title.value) title.value = c.billing === 'monthly' ? `${c.title} · ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : c.title;
    if (!amount.value) amount.value = c.value;
  };
  proj.addEventListener('change', () => { title.value = ''; amount.value = ''; fillFromProject(); });
  fillFromProject();
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
  f.append(
    field('Project', proj),
    field('What it’s for', title),
    el('div', { class: 'crm-form-row' }, field('Amount (USD)', amount), field('Due', due)),
    field('Payment link', link, 'Where the client pays: a Stripe, PayPal, Square or Venmo link'),
    field('Note', note),
    msg,
    el('div', { class: 'crm-form-actions' },
      !isNew ? el('button', { type: 'button', class: 'btn btn-ghost danger', text: inv.status === 'void' ? 'Delete' : 'Void', onclick: async () => {
        const q = inv.status === 'void' ? supabase.from('invoices').delete().eq('id', inv.id) : supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id);
        const { error } = await q;
        if (error) return toast(error.message, 'error');
        m.close(); toast(inv.status === 'void' ? 'Invoice deleted' : 'Invoice voided'); onSaved?.();
      } }) : null,
      isNew ? el('button', { type: 'submit', class: 'btn btn-ghost', 'data-status': 'draft', text: 'Save draft' }) : null,
      el('button', { type: 'submit', class: 'btn btn-primary', 'data-status': isNew ? 'sent' : '', text: isNew ? 'Send invoice' : 'Save' })));
  const m = modal(isNew ? 'New invoice' : `Invoice #${inv.number}`, f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    const status = e.submitter?.dataset.status;
    if (!title.value.trim()) return say('Say what the invoice is for.');
    if (!(Number(amount.value) > 0)) return say('Enter an amount.');
    if (link.value.trim() && !/^https:\/\//i.test(link.value.trim())) return say('The payment link should start with https://');
    const row = { contract_id: proj.value, title: title.value.trim(), amount: Number(amount.value), due_date: due.value || null, pay_link: link.value.trim() || null, note: note.value.trim() || null };
    if (status) row.status = status;
    const { error } = isNew ? await supabase.from('invoices').insert(row) : await supabase.from('invoices').update(row).eq('id', inv.id);
    if (error) return say(error.message);
    m.close();
    toast(isNew ? (status === 'sent' ? 'Invoice sent. The client was notified.' : 'Draft saved') : 'Invoice saved');
    onSaved?.();
  });
}
