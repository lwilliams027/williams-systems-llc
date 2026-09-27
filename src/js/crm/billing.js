/* =====================================================================
   Billing — shared by the project Billing tab, Finances and settings.

     Clients   what's due and when, the next monthly bill, how to pay,
               and every bill they've had
     Owners    the project's invoices: new, send, mark paid, void

   Account hold: a bill left unpaid more than HOLD_DAYS past its due date
   puts the client's account on hold. No new tickets or meeting requests
   until it's paid; the database enforces it (supabase/finances.sql).
   ===================================================================== */
import { supabase } from '../supabase.js';
import { el, fill, toast, modal, field, money, fmtDate, LIVE, ymd } from './util.js';

export const HOLD_DAYS = 60;
const DAY = 86400000;
const today0 = () => new Date(ymd(new Date()) + 'T00:00:00');

/** Days a sent bill is past its due date (0 when it isn't). */
export function pastDueDays(i) {
  if (i.status !== 'sent') return 0;
  const due = i.due_date || (i.issued_at && ymd(i.issued_at));
  if (!due) return 0;
  return Math.max(0, Math.round((today0() - new Date(due + 'T00:00:00')) / DAY));
}
export const isPastDue = (i) => pastDueDays(i) > 0;
export const causesHold = (i) => pastDueDays(i) > HOLD_DAYS;

/** Who a contract belongs to, so bills can be grouped by client. */
export const clientKey = (c) => c.client_id || (c.client_email || '').toLowerCase() || c.id;
export const clientName = (c) => c.client_name || c.company || c.client_email || c.title;

/** The bills putting this contract's client on hold (oldest first). */
export function holdFor(contract, contracts, invoices) {
  if (!contract) return [];
  const key = clientKey(contract);
  const mine = new Set(contracts.filter((c) => clientKey(c) === key).map((c) => c.id));
  mine.add(contract.id);
  return invoices.filter((i) => mine.has(i.contract_id) && causesHold(i)).sort((a, b) => pastDueDays(b) - pastDueDays(a));
}

/** A monthly plan's next bill: the start date's day of the month, from today on. */
export function nextMonthly(c) {
  if (c.billing !== 'monthly' || !LIVE.includes(c.status) || !c.start_date) return null;
  const start = new Date(c.start_date + 'T00:00:00');
  const t = today0();
  const at = (y, m) => new Date(y, m, Math.min(start.getDate(), new Date(y, m + 1, 0).getDate()));
  let d = at(t.getFullYear(), t.getMonth());
  if (d < t) d = at(t.getFullYear(), t.getMonth() + 1);
  if (d < start) d = start;
  return { date: ymd(d), amount: Number(c.value) };
}

export function invStatus(i, owner = false) {
  const late = pastDueDays(i);
  const [cls, text] = i.status === 'sent'
    ? late > HOLD_DAYS ? ['hold', `${late} days late`] : late ? ['overdue', `${late}d overdue`] : ['sent', owner ? 'Sent' : 'Due']
    : [i.status, { draft: 'Draft', paid: 'Paid', void: 'Void' }[i.status]];
  return el('span', { class: `inv-st inv-${cls}`, text });
}

/* ---------- workspace billing settings (owners set, everyone reads) ---------- */
export const BILLING_DEFAULTS = { payLink: '', invoiceNote: '', portalLink: '', dueDays: 14 };
export async function loadBillingSettings() {
  const { data } = await supabase.from('app_settings').select('key, value').in('key', ['billing', 'stripe']);
  const get = (k) => (data || []).find((r) => r.key === k)?.value;
  return { ...BILLING_DEFAULTS, ...(get('billing') || {}), stripe: get('stripe') || null };
}

/** Ask Stripe (through the stripe-link function) for this invoice's payment link. */
export async function stripeLink(invoiceId, contract, action = 'create') {
  const SITE = new URL('./', location.href).href;
  const return_url = contract ? `${SITE}portal.html?paid=1#/${contract.slug || contract.id}/billing` : null;
  const { data, error } = await supabase.functions.invoke('stripe-link', { body: { invoice_id: invoiceId, action, return_url } });
  if (error || data?.error) {
    let msg = data?.error || error?.message;
    try { msg = (await error?.context?.json?.())?.error || msg; } catch { /* keep msg */ }
    if (action === 'create') toast(`Stripe: ${msg || 'couldn’t make the payment link'}`, 'error');
    return null;
  }
  return data?.url || true;
}
export async function saveBillingSettings(value) {
  const { error } = await supabase.from('app_settings').upsert({ key: 'billing', value, updated_at: new Date().toISOString() });
  if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return false; }
  return true;
}

/* ---------- the hold banner ---------- */
export function holdBanner(bills, { owner, contracts = [] } = {}) {
  if (!bills.length) return null;
  const total = bills.reduce((n, i) => n + Number(i.amount), 0);
  const oldest = bills[0];
  const pay = !owner && oldest.pay_link ? el('a', { class: 'btn btn-primary btn-sm', href: oldest.pay_link, target: '_blank', rel: 'noopener noreferrer', text: 'Pay now' }) : null;
  const proj = (i) => contracts.find((c) => c.id === i.contract_id)?.title;
  return el('div', { class: 'hold-banner', role: 'alert' },
    el('span', { class: 'hold-ico', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' }),
    el('div', { class: 'hold-text' },
      el('strong', { text: owner ? 'Account on hold' : 'Your account is on hold' }),
      el('p', { text: owner
        ? `${money(total)} unpaid more than ${HOLD_DAYS} days (${bills.map((i) => `#${i.number}${proj(i) ? ` · ${proj(i)}` : ''}`).join(', ')}). No production until it’s paid; the client can’t open new requests.`
        : `${money(total)} is more than ${HOLD_DAYS} days past due, so work is paused and new requests are off until it’s paid. Messages still work if you have questions.` })),
    pay);
}

/* ---------- one invoice row ---------- */
export function invoiceRow(i, { owner, contracts = [], showProject = true, onChanged, defaults } = {}) {
  const proj = contracts.find((c) => c.id === i.contract_id);
  const stripeOn = Boolean(defaults?.stripe?.connected);
  const act = async (patch, msg) => {
    const { error } = await supabase.from('invoices').update(patch).eq('id', i.id);
    if (error) return toast(`Couldn’t save: ${error.message}`, 'error');
    if (stripeOn && patch.status === 'sent' && !i.pay_link) await stripeLink(i.id, proj);
    if (patch.status === 'paid' && i.stripe_link_id) await stripeLink(i.id, proj, 'deactivate');
    toast(msg); onChanged?.();
  };
  const late = pastDueDays(i);
  return el('li', { class: `inv${late > HOLD_DAYS ? ' is-hold' : late ? ' is-late' : ''}` },
    el('div', { class: 'inv-main' },
      el('strong', { text: i.title }),
      el('small', { text: [`#${i.number}`, showProject ? proj?.title : null, owner && showProject && proj ? clientName(proj) : null,
        i.status === 'paid' ? `paid ${fmtDate(i.paid_at, { month: 'short', day: 'numeric' })}` : i.due_date && i.status !== 'void' ? `due ${fmtDate(i.due_date, { month: 'short', day: 'numeric' })}` : null]
        .filter((x, n, a) => x && a.indexOf(x) === n).join(' · ') }),
      i.note && !owner ? el('p', { class: 'inv-note', text: i.note }) : null),
    el('b', { class: 'inv-amt mono', text: money(i.amount) }),
    el('span', { class: 'inv-tags' }, invStatus(i, owner), owner && (i.stripe_link_id || i.paid_via === 'stripe') ? el('span', { class: 'inv-stripe', title: i.paid_via === 'stripe' ? 'Paid through Stripe' : 'Stripe payment link', text: 'Stripe' }) : null),
    owner
      ? el('span', { class: 'inv-actions' },
        i.status === 'draft' ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Send', onclick: () => act({ status: 'sent' }, 'Sent. The client was notified.') }) : null,
        i.status === 'sent' ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Mark paid', onclick: () => act({ status: 'paid', paid_via: 'manual' }, 'Marked paid') }) : null,
        el('button', { type: 'button', class: 'link-btn', text: 'Edit', onclick: () => invoiceForm(i, { contracts, defaults, onSaved: onChanged }) }))
      : i.status === 'sent' && i.pay_link ? el('a', { class: 'btn btn-primary btn-sm', href: i.pay_link, target: '_blank', rel: 'noopener noreferrer', text: 'Pay now' }) : el('span'));
}

/* ---------- create / edit an invoice (owners) ---------- */
export async function invoiceForm(inv, { contracts, contractId, defaults, onSaved } = {}) {
  const d = defaults || await loadBillingSettings();
  const isNew = !inv;
  const f = el('form', { class: 'crm-form', novalidate: true });
  const pick = inv?.contract_id || contractId;
  const proj = el('select', {}, contracts.map((c) => el('option', { value: c.id, text: `${c.title}${c.company ? ` · ${c.company}` : ''}`, selected: pick === c.id ? true : null })));
  const title = el('input', { maxlength: 160, value: inv?.title || '', placeholder: 'e.g. Website build · first half' });
  const amount = el('input', { type: 'number', min: 0, step: 50, inputmode: 'decimal', value: inv ? inv.amount : '' });
  const due = el('input', { type: 'date', value: inv?.due_date || ymd(Date.now() + (Number(d.dueDays) || 14) * DAY) });
  const stripeOn = Boolean(d.stripe?.connected);
  // with Stripe connected, each bill gets its own link for its exact amount (unless you paste one)
  const auto = el('input', { type: 'checkbox', checked: stripeOn && (!inv || !inv.pay_link || inv.stripe_link_id) ? true : null });
  const link = el('input', { type: 'url', maxlength: 500, value: inv?.stripe_link_id ? '' : inv?.pay_link ?? (stripeOn ? '' : d.payLink) ?? '', placeholder: 'https://…' });
  const linkField = field('Payment link', link, stripeOn ? 'Only if you want to use your own link instead' : 'Where the client pays, e.g. a Stripe payment link');
  const syncAuto = () => { linkField.hidden = stripeOn && auto.checked; };
  auto.addEventListener('change', syncAuto);
  const note = el('textarea', { rows: 2, maxlength: 2000 });
  note.value = inv?.note ?? d.invoiceNote ?? '';
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
    contracts.length > 1 || !contractId ? field('Project', proj) : null,
    field('What it’s for', title),
    el('div', { class: 'crm-form-row' }, field('Amount (USD)', amount), field('Due', due)),
    stripeOn ? el('label', { class: 'inv-auto' }, auto,
      el('span', {}, el('strong', { text: 'Stripe payment link' }), el('small', { text: `Made automatically for this amount when the bill is sent${d.stripe.mode === 'test' ? ' (test mode)' : ''}. It shows as Pay now for the client, and the bill marks itself paid.` }))) : null,
    linkField,
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
  syncAuto();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    const status = e.submitter?.dataset.status;
    if (!title.value.trim()) return say('Say what the invoice is for.');
    if (!(Number(amount.value) > 0)) return say('Enter an amount.');
    const useStripe = stripeOn && auto.checked;
    let linkFailed = false;
    if (!useStripe && link.value.trim() && !/^https:\/\//i.test(link.value.trim())) return say('The payment link should start with https://');
    if (useStripe && Number(amount.value) < 0.5) return say('Stripe needs at least $0.50.');
    const row = { contract_id: proj.value, title: title.value.trim(), amount: Number(amount.value), due_date: due.value || null, note: note.value.trim() || null };
    // your own link replaces a Stripe one; with Stripe on, the link is made below
    if (!useStripe) Object.assign(row, { pay_link: link.value.trim() || null, stripe_link_id: null });
    if (status) row.status = status;
    const saveBtn = e.submitter; if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = useStripe ? 'Making the payment link…' : 'Saving…'; }
    const { data: saved, error } = isNew ? await supabase.from('invoices').insert(row).select().single() : await supabase.from('invoices').update(row).eq('id', inv.id).select().single();
    if (error) { if (saveBtn) saveBtn.disabled = false; return say(error.message); }
    if (!useStripe && inv?.stripe_link_id) await stripeLink(saved.id, null, 'deactivate');
    // a link for bills that are out (or going out), and a fresh one if the amount changed
    if (useStripe && saved.status === 'sent' && (!saved.stripe_link_id || Number(inv?.amount) !== Number(saved.amount))) {
      linkFailed = !(await stripeLink(saved.id, contracts.find((c) => c.id === saved.contract_id)));
    }
    m.close();
    if (linkFailed) { onSaved?.(); return; }   // the Stripe error stays on screen
    toast(isNew ? (status === 'sent' ? 'Invoice sent. The client was notified.' : 'Draft saved') : 'Invoice saved');
    onSaved?.();
  });
  return m;
}

const stat = (label, value, sub, cls = '') => el('div', { class: `bl-stat ${cls}` }, el('small', { text: label }), el('b', { class: 'mono', text: value }), sub ? el('span', { text: sub }) : null);
const sum = (list) => list.reduce((n, i) => n + Number(i.amount), 0);

/**
 * Billing for one or more projects: the project Billing tab (one contract)
 * or the client's account-wide billing in settings (all of theirs).
 * opts: { contracts, allContracts?, owner, onHold? }  Returns { reload, destroy }.
 */
export function billingView(root, opts) {
  const { owner } = opts;
  let invoices = [], settings = BILLING_DEFAULTS, alive = true;
  const ids = () => opts.contracts.map((c) => c.id);
  const single = opts.contracts.length === 1 ? opts.contracts[0] : null;

  async function load() {
    const all = opts.allContracts || opts.contracts;
    const [{ data }, s] = await Promise.all([
      // the hold looks at every bill of this client, not just this project's
      supabase.from('invoices').select('*').in('contract_id', all.map((c) => c.id)).order('created_at', { ascending: false }),
      loadBillingSettings(),
    ]);
    if (!alive) return;
    invoices = data || []; settings = s;
    render();
  }

  function render() {
    const all = opts.allContracts || opts.contracts;
    const mine = invoices.filter((i) => ids().includes(i.contract_id) && (owner || i.status !== 'draft'));
    const open = mine.filter((i) => i.status === 'sent').sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'));
    const late = open.filter(isPastDue);
    const paid = mine.filter((i) => i.status === 'paid');
    const hold = single ? holdFor(single, all, invoices) : opts.contracts.flatMap((c) => holdFor(c, all, invoices)).filter((i, n, a) => a.findIndex((x) => x.id === i.id) === n);
    opts.onHold?.(hold);
    const monthly = opts.contracts.map((c) => ({ c, next: nextMonthly(c) })).filter((x) => x.next).sort((a, b) => a.next.date.localeCompare(b.next.date));
    const nextBill = [...open.filter((i) => !isPastDue(i)).map((i) => ({ date: i.due_date, amount: Number(i.amount), what: i.title })), ...monthly.map(({ c, next }) => ({ ...next, what: `${c.title} · monthly`, expected: true }))]
      .filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date))[0];

    const stats = el('div', { class: 'bl-stats' },
      stat(owner ? 'Outstanding' : 'Due now', money(sum(open)), open.length ? `${open.length} unpaid bill${open.length === 1 ? '' : 's'}` : 'All paid up', late.length ? 'warn' : ''),
      stat('Past due', money(sum(late)), late.length ? `oldest ${Math.max(...late.map(pastDueDays))} days` : 'Nothing late', late.length ? (hold.length ? 'bad' : 'warn') : ''),
      stat(owner ? 'Next due' : 'Next bill', nextBill ? money(nextBill.amount) : '—', nextBill ? `${fmtDate(nextBill.date, { month: 'short', day: 'numeric' })}${nextBill.expected ? ' · expected' : ''}` : 'Nothing scheduled'),
      stat(owner ? 'Collected' : 'Paid to date', money(sum(paid)), `${paid.length} paid bill${paid.length === 1 ? '' : 's'}`));

    const card = (title, body, extra) => el('section', { class: 'bl-card' }, el('div', { class: 'bl-card-head' }, el('h2', { text: title }), extra || null), body);
    const reload = () => load();
    const rows = (list) => el('ul', { class: 'inv-list' }, list.map((i) => invoiceRow(i, { owner, contracts: all, showProject: !single, onChanged: reload, defaults: settings })));

    const upcoming = card(owner ? 'Unpaid' : 'Upcoming bills', [
      open.length ? rows(open) : null,
      monthly.length ? el('ul', { class: 'bl-plans' }, monthly.map(({ c, next }) => el('li', {},
        el('span', { class: 'bl-cal' }, el('small', { text: new Date(next.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' }) }), el('b', { text: new Date(next.date + 'T00:00:00').getDate() })),
        el('div', {}, el('strong', { text: owner ? `Next monthly bill${single ? '' : ` · ${c.title}`}` : `Monthly plan${single ? '' : ` · ${c.title}`}` }),
          el('small', { text: owner ? 'Based on the start date. Send the invoice when it’s time.' : 'Expected. You’ll get an invoice with a payment link.' })),
        el('b', { class: 'mono', text: money(next.amount) })))) : null,
      !open.length && !monthly.length ? el('p', { class: 'bl-quiet', text: owner ? 'Nothing unpaid.' : 'Nothing due. You’re all paid up.' }) : null,
    ], owner ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '+ New invoice', onclick: () => invoiceForm(null, { contracts: opts.contracts, contractId: single?.id, defaults: settings, onSaved: reload }) }) : null);

    const method = owner ? null : card('Payment method', el('div', { class: 'bl-method' },
      el('span', { class: 'bl-card-ico', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>' }),
      el('div', {},
        el('strong', { text: 'No card saved here' }),
        el('p', { text: settings.portalLink
          ? 'Cards are kept by our payment processor, never on this site. Use the link to add or change the card you pay with.'
          : 'Each bill comes with its own secure payment link, and card details are entered on the payment page, never on this site.' })),
      settings.portalLink ? el('a', { class: 'btn btn-ghost btn-sm', href: settings.portalLink, target: '_blank', rel: 'noopener noreferrer', text: 'Manage payment method' }) : null));

    const done = mine.filter((i) => i.status !== 'sent');
    const hist = card(owner ? 'All invoices' : 'Billing history', done.length ? rows(done) : el('p', { class: 'bl-quiet', text: owner ? 'Paid, draft and void invoices show up here.' : 'Paid bills show up here.' }));

    fill(root, el('div', { class: 'bl' }, holdBanner(hold, { owner, contracts: all }), stats,
      el('div', { class: 'bl-grid' }, el('div', { class: 'bl-col' }, upcoming, hist), method ? el('div', { class: 'bl-col bl-side' }, method, termsCard()) : null)));
  }

  const termsCard = () => el('section', { class: 'bl-card bl-terms' }, el('h2', { text: 'Good to know' }),
    el('ul', {},
      el('li', { text: 'Payment terms and any deposit are set in your written scope.' }),
      el('li', { text: `If a bill goes more than ${HOLD_DAYS} days past due, work pauses until it’s paid.` }),
      el('li', { text: 'Questions about a bill? Message Landon any time.' })));

  fill(root, el('p', { class: 'cv-loading', text: 'Loading billing…' }));
  load();
  const ch = supabase.channel(`billing-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
    .subscribe();
  return { reload: load, destroy: () => { alive = false; supabase.removeChannel(ch); } };
}
