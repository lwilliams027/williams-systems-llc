/* =====================================================================
   Finances (owners) — the money side of the business on one page.

     Numbers    income, expenses, profit, outstanding, past due, on hold
     Chart      income vs expenses by month
     Clients    who owes what, how late, and where each project stands
     Invoices   every bill, filtered: unpaid, past due, paid, drafts
     Expenses   what the business spends, by category

   Income counts when a bill is marked paid; expenses by the day spent.
   ===================================================================== */
import { supabase } from '../supabase.js';
import { el, fill, toast, modal, field, money, moneyShort, fmtDate, ymd, STATUS, LIVE, PENDING, REDUCED, armedButton, initials } from './util.js';
import { invoiceRow, invoiceForm, loadBillingSettings, pastDueDays, isPastDue, causesHold, clientKey, clientName, nextMonthly, HOLD_DAYS } from './billing.js';
import { hBars } from './charts.js';
import { gsap } from 'gsap';

export const EXPENSE_CATS = {
  software: 'Software', hosting: 'Hosting', contractor: 'Contractors', equipment: 'Equipment',
  marketing: 'Marketing', fees: 'Fees', office: 'Office', travel: 'Travel', other: 'Other',
};
const PERIODS = [['month', 'This month'], ['year', 'This year'], ['12m', '12 months'], ['all', 'All time']];
const sum = (list, k = 'amount') => list.reduce((n, x) => n + Number(x[k] || 0), 0);
const monthKey = (d) => ymd(d).slice(0, 7);

/** opts: { getContracts, projectHref } — returns { reload, destroy } */
export function financesView(root, opts) {
  const st = { invoices: [], expenses: [], settings: null, period: '12m', tab: 'unpaid', loaded: false };
  let alive = true;

  async function load() {
    const [inv, exp, settings] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }),
      loadBillingSettings(),
    ]);
    if (!alive) return;
    if (inv.error) toast(`Couldn’t load invoices: ${inv.error.message}`, 'error');
    if (exp.error) toast(`Couldn’t load expenses: ${exp.error.message}`, 'error');
    st.invoices = inv.data || []; st.expenses = exp.data || []; st.settings = settings;
    const first = !st.loaded;
    st.loaded = true;
    render(first);
  }

  /* ---------- the period ---------- */
  function range() {
    const now = new Date();
    if (st.period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    if (st.period === 'year') return [new Date(now.getFullYear(), 0, 1), now];
    if (st.period === '12m') return [new Date(now.getFullYear(), now.getMonth() - 11, 1), now];
    const dates = [...st.invoices.filter((i) => i.paid_at).map((i) => new Date(i.paid_at)), ...st.expenses.map((e) => new Date(e.spent_on + 'T00:00:00'))];
    return [dates.length ? new Date(Math.min(...dates)) : new Date(now.getFullYear(), now.getMonth(), 1), now];
  }
  const inRange = (d, [a, b]) => d >= a && d <= b;

  function render(animate = false) {
    const contracts = opts.getContracts();
    const r = range();
    const paid = st.invoices.filter((i) => i.status === 'paid' && i.paid_at && inRange(new Date(i.paid_at), r));
    const spent = st.expenses.filter((e) => inRange(new Date(e.spent_on + 'T00:00:00'), r));
    const income = sum(paid), expenses = sum(spent), profit = income - expenses;
    const unpaid = st.invoices.filter((i) => i.status === 'sent');
    const late = unpaid.filter(isPastDue);
    const clients = standings(contracts);
    const held = clients.filter((c) => c.hold);

    const kpi = (label, value, sub, cls = '', onclick) => el(onclick ? 'button' : 'div', { class: `fn-kpi ${cls}`, type: onclick ? 'button' : null, onclick },
      el('small', { text: label }), el('b', { class: 'mono', text: value }), sub ? el('span', { text: sub }) : null);
    const kpis = el('section', { class: 'fn-kpis' },
      kpi('Income', moneyShort(income), `${paid.length} paid bill${paid.length === 1 ? '' : 's'}`, 'good'),
      kpi('Expenses', moneyShort(expenses), `${spent.length} expense${spent.length === 1 ? '' : 's'}`),
      kpi('Profit', moneyShort(profit), income ? `${Math.round((profit / income) * 100)}% margin` : 'Income minus expenses', profit < 0 ? 'bad' : 'accent'),
      kpi('Outstanding', moneyShort(sum(unpaid)), `${unpaid.length} unpaid`, '', () => setTab('unpaid')),
      kpi('Past due', moneyShort(sum(late)), late.length ? `${late.length} bill${late.length === 1 ? '' : 's'} late` : 'Nothing late', late.length ? 'warn' : '', () => setTab('late')),
      kpi('On hold', String(held.length), held.length ? `over ${HOLD_DAYS} days unpaid` : 'No accounts on hold', held.length ? 'bad' : ''));

    const head = el('header', { class: 'fn-head' },
      el('div', {}, el('h2', { text: 'Finances' }),
        el('p', { text: [`${money(sum(unpaid))} outstanding`, late.length ? `${late.length} past due` : null, held.length ? `${held.length} on hold` : null].filter(Boolean).join(' · ') })),
      el('div', { class: 'fn-head-actions' },
        el('div', { class: 'fn-seg', role: 'tablist', 'aria-label': 'Period' }, PERIODS.map(([k, label]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(st.period === k), text: label, onclick: () => { st.period = k; render(); } }))),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '+ Expense', onclick: () => expenseForm(null) }),
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '+ Invoice', onclick: newInvoice })));

    const card = (title, body, { extra, cls = '' } = {}) => el('section', { class: `fn-card ${cls}` }, el('div', { class: 'fn-card-head' }, el('h3', { text: title }), extra || null), body);

    /* chart: income vs expenses by month */
    const months = monthsIn(r);
    const series = months.map((m) => ({
      m, income: sum(st.invoices.filter((i) => i.status === 'paid' && i.paid_at && monthKey(i.paid_at) === m)),
      expenses: sum(st.expenses.filter((e) => e.spent_on.slice(0, 7) === m)),
    }));
    const chart = card('Income vs expenses', series.some((x) => x.income || x.expenses) ? moneyChart(series) : el('p', { class: 'fn-quiet', text: 'Mark bills paid and log expenses to see the months fill in.' }), {
      cls: 'fn-chart-card',
      extra: el('ul', { class: 'fn-legend' }, el('li', {}, el('i', { class: 'inc' }), 'Income'), el('li', {}, el('i', { class: 'exp' }), 'Expenses')),
    });

    /* attention: holds first, then close to a hold, then late */
    const attn = [
      ...held.map((c) => ({ c, level: 'bad', text: `On hold · ${money(c.lateAmt)} over ${HOLD_DAYS} days` })),
      ...clients.filter((c) => !c.hold && c.oldest > HOLD_DAYS - 15).map((c) => ({ c, level: 'warn', text: `${HOLD_DAYS - c.oldest} days until hold · ${money(c.lateAmt)} late` })),
      ...clients.filter((c) => !c.hold && c.oldest > 0 && c.oldest <= HOLD_DAYS - 15).map((c) => ({ c, level: 'warn', text: `${c.oldest} days late · ${money(c.lateAmt)}` })),
    ];
    const attention = card('Who’s past due', attn.length
      ? el('ul', { class: 'fn-attn' }, attn.slice(0, 6).map(({ c, level, text }) => el('li', { class: level },
        el('a', { href: opts.projectHref(c.main, 'billing') },
          el('span', { class: 'fn-av', text: initials(c.name) }),
          el('span', { class: 'fn-attn-main' }, el('strong', { text: c.name }), el('small', { text })),
          el('b', { class: 'mono', text: money(c.outstanding) })))))
      : el('div', { class: 'fn-allclear' }, el('strong', { text: 'Nobody’s late' }), el('p', { text: 'Clients past due show up here, with how long until a hold.' })));

    /* clients: who owes what and where their projects stand */
    const clientsCard = card('Clients', clients.length ? el('div', { class: 'fn-table-wrap' }, el('table', { class: 'fn-table' },
      el('thead', {}, el('tr', {}, ['Client', 'Project', 'Billed', 'Paid', 'Owes', 'Standing', 'Next due'].map((h) => el('th', { text: h })))),
      el('tbody', {}, clients.map((c) => el('tr', { class: c.hold ? 'hold' : c.oldest ? 'late' : '', onclick: () => { location.hash = opts.projectHref(c.main, 'billing'); } },
        el('td', { 'data-label': 'Client' }, el('div', { class: 'fn-client' }, el('span', { class: 'fn-av', text: initials(c.name) }), el('span', {}, el('strong', { text: c.name }), c.company && c.company !== c.name ? el('small', { text: c.company }) : null))),
        el('td', { 'data-label': 'Project' }, c.projects.map((p) => el('a', { class: 'fn-proj', href: opts.projectHref(p, 'billing'), onclick: (e) => e.stopPropagation() },
          el('i', { class: `crm-proj-dot st-${p.status}` }), el('span', { text: p.title }),
          el('small', { text: LIVE.includes(p.status) ? `${STATUS[p.status].label} · ${p.progress}%` : STATUS[p.status]?.label || p.status })))),
        el('td', { 'data-label': 'Billed', class: 'mono', text: money(c.billed) }),
        el('td', { 'data-label': 'Paid', class: 'mono', text: money(c.paid) }),
        el('td', { 'data-label': 'Owes', class: 'mono fn-owes', text: c.outstanding ? money(c.outstanding) : '—' }),
        el('td', { 'data-label': 'Standing' }, el('span', { class: `fn-standing ${c.hold ? 'bad' : c.oldest ? 'warn' : c.outstanding ? 'due' : 'ok'}`,
          text: c.hold ? 'On hold' : c.oldest ? `${c.oldest}d late` : c.outstanding ? 'Due' : 'Paid up' })),
        el('td', { 'data-label': 'Next due', text: c.next ? `${fmtDate(c.next.date, { month: 'short', day: 'numeric' })}${c.next.expected ? ' (plan)' : ''}` : '—' }))))))
      : el('p', { class: 'fn-quiet', text: 'Clients show up here once you have live projects or invoices.' }), { cls: 'fn-clients' });

    /* invoices */
    const TABS = [
      ['unpaid', 'Unpaid', (i) => i.status === 'sent'],
      ['late', 'Past due', (i) => isPastDue(i)],
      ['paid', 'Paid', (i) => i.status === 'paid'],
      ['draft', 'Drafts', (i) => i.status === 'draft'],
      ['all', 'All', () => true],
    ];
    const [, , test] = TABS.find(([k]) => k === st.tab) || TABS[0];
    const list = st.invoices.filter(test).sort((a, b) => (st.tab === 'late' ? pastDueDays(b) - pastDueDays(a) : 0));
    const invoicesCard = card('Invoices', [
      el('div', { class: 'fn-tabs', role: 'tablist' }, TABS.map(([k, label, t]) => el('button', { type: 'button', role: 'tab', class: 'fn-tab', 'aria-selected': String(st.tab === k), onclick: () => setTab(k) },
        label, el('b', { text: st.invoices.filter(t).length })))),
      list.length ? el('ul', { class: 'inv-list' }, list.map((i) => invoiceRow(i, { owner: true, contracts, onChanged: load, defaults: st.settings })))
        : el('p', { class: 'fn-quiet', text: st.invoices.length ? 'Nothing here.' : 'No invoices yet. Create one from here or from a project’s Billing tab.' }),
    ], { cls: 'fn-invoices' });

    /* expenses */
    const byCat = Object.entries(EXPENSE_CATS).map(([k, label]) => ({ label, value: sum(spent.filter((e) => e.category === k)) })).filter((x) => x.value).sort((a, b) => b.value - a.value);
    const expensesCard = card('Expenses', [
      byCat.length ? hBars(byCat.slice(0, 5), { format: money }) : null,
      spent.length ? el('ul', { class: 'fn-exp' }, spent.slice(0, 40).map((e) => el('li', {},
        el('button', { type: 'button', class: 'fn-exp-row', onclick: () => expenseForm(e) },
          el('span', { class: `fn-cat c-${e.category}`, text: EXPENSE_CATS[e.category] }),
          el('span', { class: 'fn-exp-main' }, el('strong', { text: e.vendor || EXPENSE_CATS[e.category] }),
            el('small', { text: [fmtDate(e.spent_on, { month: 'short', day: 'numeric' }), contracts.find((c) => c.id === e.contract_id)?.title, e.note].filter(Boolean).join(' · ') })),
          el('b', { class: 'mono', text: money(e.amount) })))))
        : el('p', { class: 'fn-quiet', text: 'No expenses in this period. Log software, hosting, contractors and the like to see real profit.' }),
    ], { cls: 'fn-expenses', extra: el('button', { type: 'button', class: 'link-btn', text: '+ Add', onclick: () => expenseForm(null) }) });

    fill(root, el('div', { class: 'fn' }, head, kpis,
      el('div', { class: 'fn-row' }, chart, attention),
      clientsCard,
      el('div', { class: 'fn-row fn-row-b' }, invoicesCard, expensesCard)));
    if (animate && !REDUCED) gsap.from(root.querySelectorAll('.fn-kpi, .fn-card'), { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.035, ease: 'power3.out', clearProps: 'all' });
  }

  function setTab(k) { st.tab = k; render(); root.querySelector('.fn-invoices')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }

  /** One row per client: totals, lateness, hold, next due, their projects. */
  function standings(contracts) {
    const groups = new Map();
    for (const c of contracts) {
      if (c.status === 'lost') continue;
      const k = clientKey(c);
      if (!groups.has(k)) groups.set(k, { key: k, name: clientName(c), company: c.company, projects: [] });
      groups.get(k).projects.push(c);
    }
    const out = [];
    for (const g of groups.values()) {
      const ids = new Set(g.projects.map((p) => p.id));
      const inv = st.invoices.filter((i) => ids.has(i.contract_id));
      const open = inv.filter((i) => i.status === 'sent');
      const late = open.filter(isPastDue);
      if (!inv.length && !g.projects.some((p) => LIVE.includes(p.status) || p.status === 'complete')) continue;   // pending deals with no bills
      const nexts = [...open.filter((i) => i.due_date && !isPastDue(i)).map((i) => ({ date: i.due_date })), ...g.projects.map(nextMonthly).filter(Boolean).map((n) => ({ ...n, expected: true }))]
        .sort((a, b) => a.date.localeCompare(b.date));
      const main = g.projects.find((p) => open.some((i) => i.contract_id === p.id)) || g.projects.find((p) => LIVE.includes(p.status)) || g.projects[0];
      out.push({
        ...g, main,
        billed: sum(inv.filter((i) => ['sent', 'paid'].includes(i.status))),
        paid: sum(inv.filter((i) => i.status === 'paid')),
        outstanding: sum(open),
        lateAmt: sum(late),
        oldest: late.length ? Math.max(...late.map(pastDueDays)) : 0,
        hold: inv.some(causesHold),
        next: nexts[0] || null,
      });
    }
    return out.sort((a, b) => Number(b.hold) - Number(a.hold) || b.oldest - a.oldest || b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  }

  function newInvoice() {
    const cs = opts.getContracts().filter((c) => c.status !== 'lost');
    if (!cs.length) return toast('Invoices belong to a project. Create a contract first.', 'error');
    invoiceForm(null, { contracts: cs, defaults: st.settings, onSaved: load });
  }

  /* ---------- add / edit an expense ---------- */
  function expenseForm(x) {
    const isNew = !x;
    const cs = opts.getContracts().filter((c) => c.status !== 'lost');
    const f = el('form', { class: 'crm-form', novalidate: true });
    const amount = el('input', { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', value: x ? x.amount : '' });
    const date = el('input', { type: 'date', value: x?.spent_on || ymd(new Date()) });
    const cat = el('select', {}, Object.entries(EXPENSE_CATS).map(([k, label]) => el('option', { value: k, text: label, selected: (x?.category || 'software') === k ? true : null })));
    const vendor = el('input', { maxlength: 120, value: x?.vendor || '', placeholder: 'e.g. Supabase, Figma, a contractor' });
    const proj = el('select', {}, el('option', { value: '', text: 'Whole business' }), cs.map((c) => el('option', { value: c.id, text: c.title, selected: x?.contract_id === c.id ? true : null })));
    const note = el('textarea', { rows: 2, maxlength: 1000 });
    note.value = x?.note || '';
    const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
    f.append(
      el('div', { class: 'crm-form-row' }, field('Amount (USD)', amount), field('Date', date)),
      el('div', { class: 'crm-form-row' }, field('Category', cat), field('Paid to', vendor)),
      field('For', proj, 'Tie it to a project to see what each one really earns'),
      field('Note', note),
      msg,
      el('div', { class: 'crm-form-actions' },
        !isNew ? armedButton('Delete', 'Click again to delete', async () => {
          const { error } = await supabase.from('expenses').delete().eq('id', x.id);
          if (error) return toast(error.message, 'error');
          m.close(); toast('Expense deleted'); load();
        }, 'btn btn-ghost danger') : null,
        el('button', { type: 'submit', class: 'btn btn-primary', text: isNew ? 'Add expense' : 'Save' })));
    const m = modal(isNew ? 'Add an expense' : 'Expense', f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const say = (t) => { msg.textContent = t; msg.hidden = !t; };
      if (!(Number(amount.value) > 0)) return say('Enter an amount.');
      if (!date.value) return say('Pick the date.');
      const row = { amount: Number(amount.value), spent_on: date.value, category: cat.value, vendor: vendor.value.trim() || null, contract_id: proj.value || null, note: note.value.trim() || null };
      const { error } = isNew ? await supabase.from('expenses').insert(row) : await supabase.from('expenses').update(row).eq('id', x.id);
      if (error) return say(error.message);
      m.close(); toast(isNew ? 'Expense added' : 'Expense saved'); load();
    });
  }

  fill(root, el('div', { class: 'cv-loading', text: 'Loading finances…' }));
  load();
  const ch = supabase.channel(`finances-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => load())
    .subscribe();
  return { reload: load, render: () => st.loaded && render(), destroy: () => { alive = false; supabase.removeChannel(ch); } };
}

/** Months (YYYY-MM) across the period; at least six so the chart has shape. */
function monthsIn([a, b]) {
  const out = [];
  const end = new Date(b.getFullYear(), b.getMonth(), 1);
  let d = new Date(a.getFullYear(), a.getMonth(), 1);
  const minStart = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  if (d > minStart) d = minStart;
  while (d <= end && out.length < 36) { out.push(monthKey(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  // phones: the latest six months, so the bars stay readable
  return window.innerWidth < 640 ? out.slice(-6) : out;
}

/** Paired bars per month: income and expenses, with a profit dot. */
function moneyChart(series) {
  const W = 640, H = 230, L = 48, B = 26, T = 12;
  const top = Math.max(1, ...series.flatMap((x) => [x.income, x.expenses]));
  const mag = 10 ** Math.floor(Math.log10(top));
  const max = Math.ceil(top / mag) * mag;
  const y = (v) => T + (H - B - T) * (1 - v / max);
  const gw = (W - L) / series.length;
  const bw = Math.min(18, gw * 0.32);
  const svg = el('svg', { class: 'chart-svg fn-chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': series.map((x) => `${x.m}: income ${money(x.income)}, expenses ${money(x.expenses)}`).join('; ') });
  svg.append(el('defs', { html: '<linearGradient id="fnInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9BFF"/><stop offset="1" stop-color="#A06BFF"/></linearGradient>' }));
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    svg.append(el('line', { x1: L, x2: W, y1: y(v), y2: y(v), class: 'chart-grid' }));
    svg.append(el('text', { x: L - 8, y: y(v) + 4, class: 'chart-axis', 'text-anchor': 'end', text: moneyShort(v).replace('.00', '') }));
  }
  series.forEach((x, i) => {
    const cx = L + gw * i + gw / 2;
    const bar = (v, dx, cls, label) => el('rect', { x: cx + dx, y: y(v), width: bw, height: Math.max(0, H - B - y(v)), rx: 3, class: cls },
      el('title', { text: `${label}: ${money(v)}` }));
    svg.append(bar(x.income, -bw - 1, 'fn-bar-inc', 'Income'), bar(x.expenses, 1, 'fn-bar-exp', 'Expenses'));
    const [yy, mm] = x.m.split('-');
    svg.append(el('text', { x: cx, y: H - 8, class: 'chart-axis', 'text-anchor': 'middle',
      text: new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString(undefined, { month: 'short' }) }));
  });
  if (!REDUCED) gsap.from(svg.querySelectorAll('rect'), { scaleY: 0, transformOrigin: 'bottom', duration: 0.7, stagger: 0.02, ease: 'power3.out' });
  return svg;
}
