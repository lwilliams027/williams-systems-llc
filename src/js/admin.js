/* =====================================================================
   Owner dashboard — a small CRM for Williams Systems LLC.

     Home       charts and analytics, live contracts, what needs attention
     Contracts  every contract and its status
     Projects   in the sidebar: each contract is its own workspace at
                #/<project>/<section> (Overview, Tickets, Chat, Schedule, Files)
     Requests   project inquiries from the website + account requests
     Tickets    client requests with files and a thread; add one to the SOW
     Pending    deals not signed yet, as a board you can drag across
     Calendar   everything scheduled and everything logged, by day
     Bell       notifications (live) and reminders

   Everything is saved to Supabase and streams in live via Realtime.
   All visitor-supplied text is rendered with textContent (never innerHTML).
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase, isConfigured, BUCKET } from './supabase.js';
import {
  el, $, $$, REDUCED, STATUS, PENDING, LIVE, statusPill, money, moneyShort, price, fmtDate, fmtTime,
  timeAgo, dueText, daysFrom, ymd, toast, armedButton, icon, EVENT_KINDS, fill, initials,
} from './crm/util.js';
import { barChart, chartMotion } from './crm/charts.js';
import { contractPage, contractForm, SECTIONS, projectHref } from './crm/contract-view.js';
import { calendarView, eventModal } from './crm/calendar.js';
import { notificationBell } from './crm/notifications.js';
import { ticketView, ticketForm, ticketPill, T_KIND, T_PRIORITY, T_STATUS, OPEN_STATES } from './crm/tickets.js';

const INQ_STATUSES = [
  ['new', 'New'],
  ['in_progress', 'In progress'],
  ['won', 'Won'],
  ['closed', 'Closed'],
];
const INQ_LABEL = Object.fromEntries(INQ_STATUSES);

const NAV = [
  ['home', 'Home', icon.home],
  ['contracts', 'Contracts', icon.contracts],
  ['requests', 'Requests', icon.requests],
  ['tickets', 'Tickets', icon.tickets],
  ['pending', 'Pending', icon.pending],
  ['calendar', 'Calendar', icon.calendar],
];
const TITLES = { home: 'Home', contracts: 'Contracts', contract: 'Contract', requests: 'Requests', tickets: 'Tickets', pending: 'Pending deals', calendar: 'Calendar' };
const STATUS_COLOR = { proposal: '#7CB7FF', negotiating: '#A06BFF', awaiting_signature: '#F5B84B', active: '#3DDC84', on_hold: '#8A93A6', complete: '#2E9BFF', lost: '#FF6B6B' };

const state = {
  me: null,
  contracts: [],
  inquiries: [],
  requests: [],
  upcoming: [],
  tickets: [], tFilter: 'active', tQuery: '', tSelected: null,
  // inquiries inbox
  selectedId: null, filter: 'all', query: '', notes: [],
  // contracts list
  cFilter: 'live', cQuery: '', cSort: 'updated',
  view: null, cleanup: null, calendar: null, bell: null, channel: null,
};

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */
boot();

async function boot() {
  if (!isConfigured) { $('#configNotice').hidden = false; return; }
  // sign-in happens on login.html; only owners get past this point
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return location.replace('login.html?next=admin.html');
  const { data: admin } = await supabase.rpc('is_admin');
  if (admin !== true) return location.replace('account.html');
  enterApp(session.user);
  supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') location.replace('login.html'); });
}

const signOut = () => supabase.auth.signOut();
$('#signOutBtn').addEventListener('click', signOut);
$('#signOutSm').addEventListener('click', signOut);
$('#newContractBtn').addEventListener('click', () => contractForm(
  { status: state.view === 'pending' ? 'proposal' : 'active' },
  { onSaved: (d) => { upsertContract(d); location.hash = projectHref(d); } }));

async function enterApp(user) {
  state.me = user;
  $('#userEmail').textContent = user.email;
  supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
    state.name = data?.full_name || '';
    if (state.view === 'home') renderHome();
  });
  $('#appView').hidden = false;
  renderNav();
  await Promise.all([loadContracts(), loadInquiries(), loadRequests(), loadUpcoming(), loadTickets()]);
  subscribe();
  state.bell = notificationBell($('#bellMount'), { me: user, onOpen: openNotification, reminders });
  window.addEventListener('hashchange', route);
  route();
  if (!REDUCED) gsap.from(['.crm-side', '.crm-top'], { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */
function renderNav() {
  $('#crmNav').replaceChildren(...NAV.map(([key, label, svg]) =>
    el('a', { href: `#${key}`, class: 'crm-nav-link', 'data-route': key },
      el('span', { class: 'crm-nav-ico', html: svg }), el('span', { class: 'crm-nav-label', text: label }), el('span', { class: 'crm-nav-count', 'data-count': key }))));
  if (!$('#crmProjects')) $('#crmNav').after(el('nav', { class: 'crm-projects', id: 'crmProjects', 'aria-label': 'Projects' }));
  renderProjectsNav();
  updateCounts();
}

/** Every live or pending contract gets its own workspace in the sidebar. */
function renderProjectsNav() {
  const box = $('#crmProjects');
  if (!box) return;
  const order = (c) => (LIVE.includes(c.status) ? 0 : PENDING.includes(c.status) ? 1 : 2);
  const list = state.contracts.filter((c) => c.status !== 'lost' && c.status !== 'complete').sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
  const done = state.contracts.filter((c) => c.status === 'complete');
  const [curSlug, curSection] = state.project || [];
  const openTickets = (c) => state.tickets.filter((t) => t.contract_id === c.id && t.status === 'open').length;
  const item = (c) => {
    const on = c.slug === curSlug;
    const n = openTickets(c);
    return el('li', { class: on ? 'on' : '' },
      el('a', { href: projectHref(c), class: 'crm-proj', 'aria-current': on && (!curSection || curSection === 'overview') ? 'page' : 'false', title: c.title },
        el('i', { class: `crm-proj-dot st-${c.status}` }), el('span', { text: c.title }), n ? el('b', { class: 'crm-proj-n', title: `${n} new ticket${n === 1 ? '' : 's'}`, text: n }) : null),
      on ? el('ul', { class: 'crm-proj-sub' }, SECTIONS.map(([k, label]) => el('li', {},
        el('a', { href: projectHref(c, k), 'aria-current': (curSection || 'overview') === k ? 'page' : 'false' }, label,
          k === 'tickets' && n ? el('b', { class: 'crm-proj-n', text: n }) : null)))) : null);
  };
  fill(box, 
    el('div', { class: 'crm-projects-head' }, el('span', { text: 'Projects' }),
      el('button', { type: 'button', class: 'crm-projects-add', 'aria-label': 'New project', title: 'New project', html: icon.plus, onclick: () => $('#newContractBtn').click() })),
    list.length ? el('ul', { class: 'crm-proj-list' }, list.map(item)) : el('p', { class: 'crm-projects-empty', text: 'Projects appear here as you create contracts.' }),
    done.length ? el('details', { class: 'crm-proj-done', open: done.some((c) => c.slug === curSlug) ? true : null },
      el('summary', { text: `Complete (${done.length})` }), el('ul', { class: 'crm-proj-list' }, done.map(item))) : null);
}

function updateCounts() {
  const n = {
    contracts: state.contracts.filter((c) => LIVE.includes(c.status)).length,
    requests: state.inquiries.filter((q) => q.status === 'new').length + state.requests.filter((r) => r.status === 'new').length,
    pending: state.contracts.filter((c) => PENDING.includes(c.status)).length,
    tickets: state.tickets.filter((t) => t.status === 'open').length,
  };
  $$('[data-count]').forEach((e) => { const v = n[e.dataset.count]; e.textContent = v || ''; e.hidden = !v; e.classList.toggle('hot', ['requests', 'tickets'].includes(e.dataset.count) && v > 0); });
  const sub = { inbox: state.inquiries.filter((q) => q.status === 'new').length, access: state.requests.filter((r) => r.status === 'new').length };
  $$('[data-subcount]').forEach((e) => { e.textContent = sub[e.dataset.subcount] || ''; });
  const rq = $('#rqSummary');
  if (rq) {
    const bits = [sub.inbox ? `${sub.inbox} new inquir${sub.inbox === 1 ? 'y' : 'ies'}` : null, sub.access ? `${sub.access} account request${sub.access === 1 ? '' : 's'}` : null].filter(Boolean);
    rq.textContent = bits.length ? `${bits.join(' · ')} waiting for you` : 'All caught up. New website inquiries and account requests land here.';
  }
  renderProjectsNav();
  state.bell?.update();
}

function route() {
  const hash = location.hash.slice(1) || 'home';
  if (hash.startsWith('/')) return routeProject(hash.slice(1).split('/').map(decodeURIComponent));
  state.project = null;
  const [view, arg] = hash.split('/');
  if (view === 'access') return location.replace('#requests/accounts');
  if (view === 'contract' && arg) {
    const c = state.contracts.find((x) => x.id === arg);
    if (c) return location.replace(projectHref(c));
  }
  const v = TITLES[view] ? view : 'home';
  state.cleanup?.(); state.cleanup = null;
  state.view = v;
  for (const id of Object.keys(TITLES)) $(`#view-${id}`).hidden = id !== v;
  const navKey = v === 'contract' ? 'contracts' : v;
  $$('.crm-nav-link').forEach((a) => a.setAttribute('aria-current', a.dataset.route === navKey ? 'page' : 'false'));
  $('#viewTitle').textContent = TITLES[v];
  document.querySelector('.crm-top').classList.toggle('has-page-head', ['home', 'contracts', 'requests', 'tickets', 'pending', 'calendar'].includes(v));
  $('#newContractBtn').querySelector('span').textContent = v === 'pending' ? 'New deal' : 'New contract';
  document.title = `${TITLES[v]} — Williams Systems LLC`;
  window.scrollTo(0, 0);

  if (v === 'home') renderHome();
  else if (v === 'contracts') renderContracts();
  else if (v === 'contract') location.replace('#contracts');
  else if (v === 'requests') switchRequests(arg === 'accounts' ? 'access' : 'inbox');
  else if (v === 'tickets') renderTickets(arg);
  else if (v === 'pending') renderPending();
  else if (v === 'calendar') {
    if (!state.calendar) {
      state.calendar = calendarView($('#view-calendar'), {
        getContracts: () => state.contracts,
        onOpenContract: (id) => { location.hash = `#contract/${id}`; },
        onOpenRequests: (t) => { location.hash = t === 'accounts' ? '#requests/accounts' : '#requests'; },
      });
    } else state.calendar.reload();
  }
}

/** A project workspace: #/<slug>/<section>/<sub> */
async function routeProject([slug, section = 'overview', sub]) {
  state.cleanup?.(); state.cleanup = null;
  state.view = 'contract';
  state.project = [slug, section];
  for (const id of Object.keys(TITLES)) $(`#view-${id}`).hidden = id !== 'contract';
  $$('.crm-nav-link').forEach((a) => a.setAttribute('aria-current', 'false'));
  const c = state.contracts.find((x) => x.slug === slug);
  $('#viewTitle').textContent = c ? c.title : 'Project';
  document.querySelector('.crm-top').classList.remove('has-page-head');
  document.title = `${c ? c.title : 'Project'} — Williams Systems LLC`;
  $('#newContractBtn').querySelector('span').textContent = 'New contract';
  renderProjectsNav();
  window.scrollTo(0, 0);
  const token = (state.routeToken = Symbol('route'));
  const stop = await contractPage($('#view-contract'), {
    slug, section, sub, owner: true, me: state.me,
    onChanged: (d) => { upsertContract(d); if (d.slug !== slug) history.replaceState(null, '', projectHref(d, section, sub)); },
    onDeleted: () => { state.contracts = state.contracts.filter((x) => x.slug !== slug); updateCounts(); location.hash = '#contracts'; },
    onRead: () => state.bell?.refresh(),
    addEvent: (init) => eventModal(init, { contracts: state.contracts, onSaved: () => { loadUpcoming(); state.calendar?.reload(); } }),
  });
  if (state.routeToken === token) state.cleanup = stop; else stop();
}

function openNotification(n) {
  if (n.ticket_id) location.hash = `#tickets/${n.ticket_id}`;
  else if (n.contract_id) location.hash = `#contract/${n.contract_id}`;
  else if (n.target === 'accounts') location.hash = '#requests/accounts';
  else if (n.target === 'requests') location.hash = '#requests';
  else if (n.target === 'calendar') location.hash = '#calendar';
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
async function loadContracts() {
  const { data, error } = await supabase.from('contracts').select('*').order('updated_at', { ascending: false });
  if (error) return toast(`Couldn’t load contracts: ${error.message}`, 'error');
  state.contracts = data;
  updateCounts();
}

function upsertContract(c) {
  const i = state.contracts.findIndex((x) => x.id === c.id);
  if (i >= 0) state.contracts[i] = c; else state.contracts.unshift(c);
  updateCounts();
}

async function saveContract(id, patch, msg) {
  const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single();
  if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return null; }
  upsertContract(data);
  if (msg) toast(msg);
  return data;
}

async function loadRequests() {
  const { data, error } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false });
  if (!error) state.requests = data;
  updateCounts();
}

async function loadUpcoming() {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 14);
  const { data } = await supabase.from('events').select('*').gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at');
  state.upcoming = data || [];
}

let refreshTimer;
function subscribe() {
  const soon = (fn) => { clearTimeout(refreshTimer); refreshTimer = setTimeout(fn, 250); };
  state.channel = supabase.channel('crm-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => soon(async () => {
      await loadContracts();
      if (state.view === 'home') renderHome();
      if (state.view === 'contracts') renderContracts();
      if (state.view === 'pending') renderPending();
    }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => soon(async () => {
      await loadTickets();
      if (state.view === 'tickets') renderTicketList();
      if (state.view === 'home') renderHome();
    }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => { await loadUpcoming(); if (state.view === 'home') renderHome(); state.bell?.update(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, async () => { await loadRequests(); if (!$('#accessView').hidden) loadAccess(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        if (state.inquiries.some((q) => q.id === payload.new.id)) return;
        state.inquiries.unshift(payload.new);
        renderList(payload.new.id);
      } else if (payload.eventType === 'UPDATE') {
        const i = state.inquiries.findIndex((q) => q.id === payload.new.id);
        if (i >= 0) state.inquiries[i] = payload.new;
        renderList();
        if (payload.new.id === state.selectedId) syncStatusSelect(payload.new.status);
      } else if (payload.eventType === 'DELETE') {
        state.inquiries = state.inquiries.filter((q) => q.id !== payload.old.id);
        if (state.selectedId === payload.old.id) { state.selectedId = null; renderDetail(); }
        renderList();
      }
      updateCounts();
    })
    .subscribe((status) => { $('#liveBadge').classList.toggle('on', status === 'SUBSCRIBED'); });
}

/** Things worth a nudge, worked out from what's loaded. */
function reminders() {
  const out = [];
  for (const c of state.contracts) {
    if (PENDING.includes(c.status)) {
      const quiet = Math.floor((Date.now() - new Date(c.updated_at)) / 86400000);
      if (quiet >= 7) out.push({ kind: 'reminder', title: `Follow up: ${c.title}`, body: `${STATUS[c.status].label} · quiet for ${quiet} days`, contract_id: c.id });
    }
    if (LIVE.includes(c.status) && c.due_date && daysFrom(c.due_date) < 0) {
      out.push({ kind: 'reminder', title: `Overdue: ${c.title}`, body: dueText(c), contract_id: c.id });
    }
  }
  for (const t of state.tickets) {
    if (t.status !== 'open') continue;
    const age = Math.floor((Date.now() - new Date(t.updated_at)) / 3600000);
    if (t.priority === 'urgent' || t.priority === 'high' || age >= 24) {
      out.push({ kind: 'reminder', title: `Ticket #${t.number}: ${t.title}`, body: `${T_PRIORITY[t.priority]} priority · waiting ${age >= 24 ? `${Math.floor(age / 24)}d` : `${age}h`}`, ticket_id: t.id });
    }
  }
  const today = ymd(new Date());
  for (const e of state.upcoming) {
    if (ymd(e.starts_at) === today) out.push({ kind: 'event', title: `Today: ${e.title}`, body: e.all_day ? EVENT_KINDS[e.kind] : `${EVENT_KINDS[e.kind]} · ${fmtTime(e.starts_at)}`, contract_id: e.contract_id, target: 'calendar' });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Home: charts and analytics                                         */
/* ------------------------------------------------------------------ */
function renderHome() {
  const root = $('#view-home');
  const all = state.contracts;
  const live = all.filter((c) => LIVE.includes(c.status));
  const pending = all.filter((c) => PENDING.includes(c.status));
  const sum = (list) => list.reduce((s, c) => s + Number(c.value || 0), 0);
  const monthly = live.filter((c) => c.billing === 'monthly');
  const won = all.filter((c) => c.signed_at).length;
  const lost = all.filter((c) => c.status === 'lost').length;
  const openTickets = state.tickets.filter((t) => OPEN_STATES.includes(t.status));
  const newTickets = openTickets.filter((t) => t.status === 'open').length;
  const weekAgo = Date.now() - 7 * 86400000;
  const newReqs = [...state.inquiries, ...state.requests].filter((r) => new Date(r.created_at) > weekAgo).length;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const projectOf = (id) => state.contracts.find((c) => c.id === id);
  const linkTo = (c) => (c ? projectHref(c) : '#contracts');

  // revenue by month: one-time projects count in the month they're signed,
  // monthly plans count every month they're running
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); d.setHours(0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    let v = 0;
    for (const c of all) {
      if (!c.signed_at) continue;
      const s = new Date(c.signed_at), e = c.closed_at ? new Date(c.closed_at) : new Date();
      if (c.billing === 'monthly') { if (s < end && e >= d && c.status !== 'lost') v += Number(c.value); }
      else if (s >= d && s < end) v += Number(c.value);
    }
    months.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), value: v });
  }
  const thisMonth = months.at(-1).value, lastMonth = months.at(-2).value;
  const change = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  /* ---------- greeting + one-line summary ---------- */
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = (state.name || '').split(' ')[0];
  const today = ymd(new Date());
  const todays = state.upcoming.filter((e) => ymd(e.starts_at) === today);
  const summary = [
    live.length ? plural(live.length, 'live project') : 'No live projects yet',
    newTickets ? plural(newTickets, 'new ticket') : null,
    todays.length ? `${todays[0].title}${todays[0].all_day ? ' today' : ` at ${fmtTime(todays[0].starts_at)}`}${todays.length > 1 ? ` +${todays.length - 1} more` : ''}` : 'nothing scheduled today',
  ].filter(Boolean).join(' · ');

  /* ---------- the four numbers that matter ---------- */
  const stat = (label, value, sub, href) => el('a', { class: 'hm-stat', href },
    el('span', { class: 'hm-stat-label', text: label }),
    el('b', { class: 'hm-stat-value', text: value }),
    el('small', { text: sub }));
  const stats = el('section', { class: 'hm-stats', 'aria-label': 'Key numbers' },
    stat('Live projects', String(live.length), live.length ? `${money(sum(live.filter((c) => c.billing !== 'monthly')))} in project work` : 'Signed contracts show here', '#contracts'),
    stat('Monthly recurring', money(sum(monthly)), monthly.length ? plural(monthly.length, 'monthly plan') : 'No monthly plans yet', '#contracts'),
    stat('Pipeline', moneyShort(sum(pending)), `${plural(pending.length, 'deal')}${won + lost ? ` · ${Math.round((won / (won + lost)) * 100)}% win rate` : ''}`, '#pending'),
    stat('Open tickets', String(openTickets.length), newTickets ? `${newTickets} new · ${plural(newReqs, 'request')} this week` : `${plural(newReqs, 'request')} this week`, '#tickets'));

  /* ---------- cards ---------- */
  const card = (title, body, { link, extra, cls = '' } = {}) => el('section', { class: `hm-card ${cls}` },
    el('header', { class: 'hm-card-head' }, el('h2', { text: title }), extra || null, link ? el('a', { href: link[1], class: 'hm-more', text: link[0] }) : null),
    body);
  const quiet = (text) => el('p', { class: 'hm-quiet', text });

  const revenue = card('Revenue', barChart(months, { format: money, empty: 'Signed contracts will chart here' }), {
    cls: 'hm-revenue',
    extra: el('div', { class: 'hm-figure' },
      el('b', { text: money(thisMonth) }),
      el('small', {}, 'this month', change != null && isFinite(change) ? el('em', { class: change >= 0 ? 'up' : 'down', text: ` ${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%` }) : null)),
  });

  const projects = card('Live projects', live.length
    ? el('ul', { class: 'hm-list' }, live.slice(0, 6).map((c) => {
      const late = c.due_date && daysFrom(c.due_date) < 0;
      const tks = state.tickets.filter((t) => t.contract_id === c.id && t.status === 'open').length;
      return el('li', {}, el('a', { href: projectHref(c), class: 'hm-proj' },
        el('span', { class: 'hm-av', text: initials(c.company || c.client_name || c.title) }),
        el('span', { class: 'hm-proj-main' }, el('strong', { text: c.title }), el('small', { text: [c.company, c.client_name].filter(Boolean).join(' · ') || 'No client yet' })),
        el('span', { class: 'hm-proj-prog', title: `${c.progress}% done` }, el('span', { class: 'hm-bar' }, el('i', { style: { width: `${c.progress}%` } })), el('small', { class: 'mono', text: `${c.progress}%` })),
        el('span', { class: 'hm-proj-meta' }, el('b', { class: 'mono', text: price(c) }),
          el('small', { class: late ? 'late' : '', text: c.due_date ? dueText(c) : c.status === 'on_hold' ? 'On hold' : 'Ongoing' })),
        tks ? el('span', { class: 'hm-badge', title: `${tks} new ticket${tks === 1 ? '' : 's'}`, text: tks }) : null));
    }))
    : quiet('No live projects yet. When a deal is signed, it shows up here.'),
  { link: live.length > 6 ? [`All ${live.length} →`, '#contracts'] : ['Contracts →', '#contracts'] });

  const attention = reminders();
  const needs = card('Needs attention', attention.length
    ? el('ul', { class: 'hm-attn' }, attention.slice(0, 5).map((r) => el('li', {},
      el('a', { href: r.ticket_id ? `#tickets/${r.ticket_id}` : r.contract_id ? linkTo(projectOf(r.contract_id)) : '#calendar' },
        el('i', { class: `hm-dot ${r.kind === 'event' ? 'ev' : r.ticket_id ? 'tk' : 'warn'}` }),
        el('span', {}, el('strong', { text: r.title }), el('small', { text: r.body }))))))
    : el('p', { class: 'hm-clear' }, el('i', { class: 'hm-dot ok' }), 'All clear. Nothing overdue or waiting on you.'));

  const next = state.upcoming.filter((e) => new Date(e.starts_at) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 4);
  const upcoming = card('Coming up', next.length
    ? el('ul', { class: 'hm-agenda' }, next.map((e) => el('li', { class: `k-${e.kind}` },
      el('span', { class: 'hm-date' }, el('small', { text: new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short' }) }), el('b', { text: new Date(e.starts_at).getDate() })),
      el('span', { class: 'hm-agenda-main' }, el('strong', { text: e.title }),
        el('small', { text: [e.all_day ? EVENT_KINDS[e.kind] : fmtTime(e.starts_at), projectOf(e.contract_id)?.title].filter(Boolean).join(' · ') })),
      e.link ? el('a', { class: 'hm-join', href: e.link, target: '_blank', rel: 'noopener noreferrer', text: 'Join' }) : null)))
    : quiet('Nothing in the next two weeks.'), { link: ['Calendar →', '#calendar'] });

  const pipeline = card('Pipeline', el('ul', { class: 'hm-pipe' }, PENDING.map((k) => {
    const l = pending.filter((c) => c.status === k);
    const max = Math.max(1, ...PENDING.map((s2) => sum(pending.filter((c) => c.status === s2))));
    return el('li', {},
      el('div', { class: 'hm-pipe-top' }, el('span', {}, el('i', { style: { background: STATUS_COLOR[k] } }), STATUS[k].label), el('b', { class: 'mono', text: money(sum(l)) })),
      el('div', { class: 'hm-pipe-track' }, el('i', { style: { width: `${(sum(l) / max) * 100}%`, background: STATUS_COLOR[k] } })),
      el('small', { text: plural(l.length, 'deal') }));
  })), { link: ['Board →', '#pending'] });

  fill(root, el('div', { class: 'hm' },
    el('header', { class: 'hm-hello' },
      el('p', { class: 'hm-date mono', text: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }),
      el('h2', {}, `${hello}${first ? ', ' : '.'}`, first ? el('span', { class: 'hm-name', text: `${first}.` }) : null),
      el('p', { class: 'hm-summary', text: summary })),
    stats,
    el('div', { class: 'hm-grid' },
      el('div', { class: 'hm-col' }, revenue, projects),
      el('div', { class: 'hm-col' }, needs, upcoming, pipeline))));
  chartMotion.on = false;   // later visits and live refreshes don't replay the chart animation
}

/* ------------------------------------------------------------------ */
/*  Contracts                                                          */
/* ------------------------------------------------------------------ */
const C_FILTERS = [
  ['live', 'Live', (c) => LIVE.includes(c.status)],
  ['pending', 'Pending', (c) => PENDING.includes(c.status)],
  ['complete', 'Complete', (c) => c.status === 'complete'],
  ['lost', 'Lost', (c) => c.status === 'lost'],
  ['all', 'All', () => true],
];
const C_SORTS = [
  ['updated', 'Recently updated', (a, b) => new Date(b.updated_at) - new Date(a.updated_at)],
  ['due', 'Due soonest', (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')],
  ['value', 'Highest price', (a, b) => Number(b.value) - Number(a.value)],
  ['name', 'Name', (a, b) => a.title.localeCompare(b.title)],
];
const C_GROUPS = [['Live', LIVE], ['Pending', PENDING], ['Complete', ['complete']], ['Lost', ['lost']]];
let cShell = null;

function renderContracts() {
  const root = $('#view-contracts');
  if (!cShell) {
    // built once, so typing in the search box never loses focus
    const search = el('input', { type: 'search', placeholder: 'Search projects, clients, companies…', 'aria-label': 'Search contracts' });
    search.addEventListener('input', () => { state.cQuery = search.value; renderContractList(); });
    const sort = el('select', { class: 'ct-sort', 'aria-label': 'Sort' }, C_SORTS.map(([k, label]) => el('option', { value: k, text: label })));
    sort.addEventListener('change', () => { state.cSort = sort.value; renderContractList(); });
    cShell = {
      head: el('header', { class: 'ct-head' }),
      seg: el('div', { class: 'ct-seg', role: 'tablist', 'aria-label': 'Filter contracts' }),
      list: el('section', { class: 'ct-card' }),
      tools: el('div', { class: 'ct-tools' },
        el('label', { class: 'ct-search' }, el('span', { class: 'ct-search-ico', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }), search),
        sort),
    };
    fill(root, el('div', { class: 'ct' }, cShell.head, el('div', { class: 'ct-bar' }, cShell.seg, cShell.tools), cShell.list));
  }
  renderContractList();
}

function renderContractList() {
  if (!cShell) return;
  const all = state.contracts;
  const sum = (list) => list.reduce((s, c) => s + Number(c.value || 0), 0);
  const live = all.filter((c) => LIVE.includes(c.status));
  const project = live.filter((c) => c.billing !== 'monthly');
  const monthly = live.filter((c) => c.billing === 'monthly');

  fill(cShell.head,
    el('div', {},
      el('h2', { text: 'Contracts' }),
      el('p', { text: all.length
        ? [`${live.length} live`, project.length ? `${money(sum(project))} in project work` : null, monthly.length ? `${money(sum(monthly))}/mo recurring` : null,
          all.filter((c) => PENDING.includes(c.status)).length ? `${all.filter((c) => PENDING.includes(c.status)).length} pending` : null].filter(Boolean).join(' · ')
        : 'Every deal you make lives here, from proposal to complete.' })));

  fill(cShell.seg, C_FILTERS.map(([k, label, test]) => el('button', {
    type: 'button', role: 'tab', class: 'ct-seg-btn', 'aria-selected': String(state.cFilter === k),
    onclick: () => { state.cFilter = k; renderContractList(); },
  }, label, el('span', { text: all.filter(test).length }))));

  const test = C_FILTERS.find((f) => f[0] === state.cFilter)[2];
  const q = (state.cQuery || '').trim().toLowerCase();
  const sorter = (C_SORTS.find((x) => x[0] === state.cSort) || C_SORTS[0])[2];
  const rows = all.filter(test)
    .filter((c) => !q || [c.title, c.client_name, c.client_email, c.company].some((s) => s && s.toLowerCase().includes(q)))
    .sort(sorter);

  if (!rows.length) {
    fill(cShell.list, el('div', { class: 'ct-empty' },
      el('span', { class: 'ct-empty-ico', html: icon.contracts }),
      el('strong', { text: q ? `Nothing matches “${state.cQuery.trim()}”` : all.length ? `No ${C_FILTERS.find((f) => f[0] === state.cFilter)[1].toLowerCase()} contracts` : 'No contracts yet' }),
      el('p', { text: q ? 'Try a client’s name, their company, or the project title.' : all.length ? 'They’ll show up here when there are some.' : 'Create one, or turn a website request into a deal from Requests.' }),
      !q && !all.length ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'New contract', onclick: () => $('#newContractBtn').click() }) : null));
    return;
  }

  const head = el('div', { class: 'ct-row ct-labels', 'aria-hidden': 'true' },
    el('span'), el('span', { text: 'Project' }), el('span', { text: 'Client' }), el('span', { text: 'Status' }),
    el('span', { text: 'Progress' }), el('span', { class: 'r', text: 'Price' }), el('span', { class: 'r', text: 'Due' }), el('span'));
  const grouped = state.cFilter === 'all' && !q
    ? C_GROUPS.map(([label, sts]) => [label, rows.filter((c) => sts.includes(c.status))]).filter(([, l]) => l.length)
    : [[null, rows]];
  fill(cShell.list, head, grouped.map(([label, list]) => [
    label ? el('h3', { class: 'ct-group' }, label, el('span', { text: list.length })) : null,
    el('ul', { class: 'ct-rows' }, list.map(contractRow)),
  ]));
}

function contractRow(c) {
  const late = c.due_date && daysFrom(c.due_date) < 0 && LIVE.includes(c.status);
  const tks = state.tickets.filter((t) => t.contract_id === c.id && t.status === 'open').length;
  const due = c.due_date ? dueText(c) : c.billing === 'monthly' && LIVE.includes(c.status) ? 'Ongoing' : '—';
  return el('li', {}, el('a', { class: `ct-row${c.status === 'lost' ? ' is-lost' : ''}`, href: projectHref(c) },
    el('span', { class: 'hm-av', text: initials(c.company || c.client_name || c.title) }),
    el('span', { class: 'ct-main' }, el('strong', {}, el('span', { class: 'ct-title', text: c.title }), tks ? el('b', { class: 'hm-badge', title: `${tks} new ticket${tks === 1 ? '' : 's'}`, text: tks }) : null),
      el('small', { text: c.company || (c.billing === 'monthly' ? 'Monthly plan' : 'One-time project') })),
    el('span', { class: 'ct-client' }, el('span', { text: c.client_name || c.client_email || 'No client yet' }),
      c.client_email && !c.client_id ? el('small', { class: 'ct-warn', text: 'Not signed up yet' }) : c.client_id ? el('small', { text: 'Portal active' }) : null),
    el('span', { class: 'ct-status' }, statusPill(c.status)),
    el('span', { class: 'hm-proj-prog', title: `${c.progress}% done` }, el('span', { class: 'hm-bar' }, el('i', { style: { width: `${c.progress}%` } })), el('small', { class: 'mono', text: `${c.progress}%` })),
    el('span', { class: 'ct-price r mono', text: price(c) }),
    el('span', { class: `ct-due r${late ? ' late' : ''}`, text: due }),
    el('span', { class: 'ct-go', 'aria-hidden': 'true', text: '›' })));
}

/* ------------------------------------------------------------------ */
/*  Tickets                                                            */
/* ------------------------------------------------------------------ */
const T_FILTERS = [
  ['active', 'Active', (t) => OPEN_STATES.includes(t.status)],
  ['open', 'New', (t) => t.status === 'open'],
  ['waiting', 'Waiting on client', (t) => t.status === 'waiting'],
  ['done', 'Resolved', (t) => ['resolved', 'closed'].includes(t.status)],
  ['all', 'All', () => true],
];
const PRIO_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

async function loadTickets() {
  const { data, error } = await supabase.from('tickets').select('*').order('updated_at', { ascending: false });
  if (error) return toast(`Couldn’t load tickets: ${error.message}`, 'error');
  state.tickets = data;
  updateCounts();
}

const tListEl = el('ul', { class: 'tk-list' });
const tDetailEl = el('section', { class: 'tk-detail' });
let tShell;

function renderTickets(id) {
  const root = $('#view-tickets');
  if (!tShell) {
    const search = el('input', { type: 'search', placeholder: 'Search tickets, projects, clients…', 'aria-label': 'Search tickets' });
    search.addEventListener('input', () => { state.tQuery = search.value.trim().toLowerCase(); renderTicketList(); });
    tShell = el('div', { class: 'tk-shell tq-card' }, el('aside', { class: 'tk-side' }, tListEl), tDetailEl);
    root.replaceChildren(el('div', { class: 'rq' },
      el('header', { class: 'ct-head' }, el('div', {}, el('h2', { text: 'Tickets' }), el('p', { id: 'tkSummary' }))),
      el('div', { class: 'ct-bar' },
        el('div', { class: 'ct-seg', role: 'tablist', id: 'tkTabs', 'aria-label': 'Filter tickets' }),
        el('div', { class: 'ct-tools' },
          el('label', { class: 'ct-search' }, el('span', { class: 'ct-search-ico', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }), search),
          el('button', { type: 'button', class: 'btn btn-primary btn-sm tq-new', html: `${icon.plus}<span>New ticket</span>`, onclick: () => ticketForm({ contracts: state.contracts, owner: true, onCreated: (t) => { state.tickets.unshift(t); location.hash = `#tickets/${t.id}`; } }) }))),
      tShell));
  }
  state.tSelected = id || null;
  tShell.classList.toggle('show-detail', Boolean(id));
  renderTicketList();
  state.cleanup?.();
  if (!id) {
    tDetailEl.replaceChildren(el('div', { class: 'detail-empty' },
      el('span', { class: 'tk-empty-ico', html: icon.tickets }),
      el('strong', { text: state.tickets.length ? 'No ticket selected' : 'No tickets yet' }),
      el('p', { text: state.tickets.length ? 'Pick one to read it, reply, or add it to the scope of work.' : 'When a client sends a request from their project page, it lands here.' })));
    return;
  }
  ticketView(tDetailEl, {
    id, owner: true, me: state.me, contracts: state.contracts,
    onBack: () => { location.hash = '#tickets'; },
    onChanged: (t) => { const i = state.tickets.findIndex((x) => x.id === t.id); if (i >= 0) state.tickets[i] = t; renderTicketList(); updateCounts(); },
    onDeleted: () => { state.tickets = state.tickets.filter((t) => t.id !== id); updateCounts(); location.hash = '#tickets'; },
    onRead: () => state.bell?.refresh(),
  }).then((stop) => { if (state.tSelected === id) state.cleanup = stop; else stop(); });
}

function renderTicketList() {
  const tabs = $('#tkTabs');
  if (!tabs) return;
  tabs.replaceChildren(...T_FILTERS.map(([k, label, test]) => el('button', {
    type: 'button', role: 'tab', class: 'ct-seg-btn', 'aria-selected': String(state.tFilter === k),
    onclick: () => { state.tFilter = k; renderTicketList(); },
  }, label, el('span', { text: state.tickets.filter(test).length }))));
  const active = state.tickets.filter((t) => OPEN_STATES.includes(t.status));
  const hot = active.filter((t) => ['high', 'urgent'].includes(t.priority)).length;
  const fresh = active.filter((t) => t.status === 'open').length;
  const waiting = active.filter((t) => t.status === 'waiting').length;
  $('#tkSummary').textContent = active.length
    ? [`${active.length} active`, fresh ? `${fresh} new` : null, hot ? `${hot} high priority` : null, waiting ? `${waiting} waiting on the client` : null].filter(Boolean).join(' · ')
    : 'All caught up. Client requests from every project land here.';
  const test = T_FILTERS.find((x) => x[0] === state.tFilter)[2];
  const q = state.tQuery;
  const nameOf = (t) => state.contracts.find((c) => c.id === t.contract_id);
  const rows = state.tickets.filter(test)
    .filter((t) => !q || [t.title, t.body, `#${t.number}`, nameOf(t)?.title, nameOf(t)?.client_name, nameOf(t)?.company].some((x) => x && x.toLowerCase().includes(q)))
    .sort((a, b) => (OPEN_STATES.includes(a.status) && OPEN_STATES.includes(b.status) ? PRIO_RANK[a.priority] - PRIO_RANK[b.priority] : 0) || new Date(b.updated_at) - new Date(a.updated_at));
  if (!rows.length) {
    tListEl.replaceChildren(el('li', { class: 'list-empty', text: state.tickets.length ? 'Nothing here.' : 'No tickets yet.' }));
    return;
  }
  tListEl.replaceChildren(...rows.map((t) => {
    const c = nameOf(t);
    return el('li', {}, el('a', { href: `#tickets/${t.id}`, class: `tk-item${t.id === state.tSelected ? ' on' : ''}${t.status === 'open' ? ' new' : ''}` },
      el('span', { class: 'inq-row' },
        el('strong', { class: 'inq-name', text: `#${t.number} ${t.title}` }),
        el('time', { class: 'inq-time mono', text: timeAgo(t.updated_at) })),
      el('span', { class: 'inq-sub', text: [c?.company || c?.client_name, c?.title].filter(Boolean).join(' · ') || 'No contract' }),
      el('span', { class: 'inq-row' },
        el('span', { class: 'tk-item-tags' }, ticketPill(t.status),
          t.priority === 'urgent' || t.priority === 'high' ? el('span', { class: `tk-tag pr-${t.priority}`, text: T_PRIORITY[t.priority] }) : null,
          t.sow_added_at ? el('span', { class: 'tk-tag in-sow', text: 'SOW' }) : null),
        el('span', { class: 'inq-files mono', text: T_KIND[t.kind] }))));
  }));
}

/* ------------------------------------------------------------------ */
/*  Pending deals board                                                */
/* ------------------------------------------------------------------ */
function renderPending() {
  const root = $('#view-pending');
  const all = state.contracts;
  const pending = all.filter((c) => PENDING.includes(c.status));
  const sum = (list) => list.reduce((s, c) => s + Number(c.value || 0), 0);
  const won = all.filter((c) => c.signed_at).length;
  const lost = all.filter((c) => c.status === 'lost').length;
  const quiet = pending.filter((c) => (Date.now() - new Date(c.updated_at)) / 86400000 >= 7).length;

  const cols = PENDING.map((k) => {
    const list = pending.filter((c) => c.status === k).sort((a, b) => Number(b.value) - Number(a.value));
    const col = el('section', { class: 'pd-col', 'data-status': k, style: { '--sc': STATUS_COLOR[k] } },
      el('header', { class: 'pd-col-head' },
        el('div', { class: 'pd-col-title' }, el('i'), el('h2', { text: STATUS[k].label }), el('span', { class: 'pd-n', text: list.length })),
        el('b', { class: 'pd-total', text: money(sum(list)) })),
      list.length ? el('ul', { class: 'pd-list' }, list.map(dealCard)) : el('div', { class: 'pd-drop', text: 'Drop a deal here' }),
      el('button', { type: 'button', class: 'pd-add', html: `${icon.plus}<span>Add deal</span>`, onclick: () => contractForm({ status: k }, { onSaved: (d) => { upsertContract(d); renderPending(); } }) }));
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain');
      const c = state.contracts.find((x) => x.id === id);
      if (c && c.status !== k) { c.status = k; renderPending(); await saveContract(id, { status: k }, `Moved to ${STATUS[k].label}`); renderPending(); }
    });
    return col;
  });

  const decided = all.filter((c) => c.signed_at || c.status === 'lost').sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5);
  fill(root, el('div', { class: 'rq' },
    el('header', { class: 'ct-head' }, el('div', {},
      el('h2', { text: 'Pending deals' }),
      el('p', { text: pending.length
        ? [`${money(sum(pending))} in the pipeline`, `${pending.length} deal${pending.length === 1 ? '' : 's'}`, won + lost ? `${Math.round((won / (won + lost)) * 100)}% win rate` : null, quiet ? `${quiet} gone quiet` : null].filter(Boolean).join(' · ')
        : 'No deals waiting on a signature. New proposals start here.' }))),
    el('p', { class: 'pd-hint', text: 'Drag a deal between stages. Mark it Won when it’s signed: it becomes a live project and the client is told.' }),
    el('div', { class: 'pd-board' }, cols),
    decided.length ? el('section', { class: 'hm-card' },
      el('header', { class: 'hm-card-head' }, el('h2', { text: 'Recently decided' }), el('a', { class: 'hm-more', href: '#contracts', text: 'Contracts →' })),
      el('ul', { class: 'hm-list' }, decided.map((c) => el('li', {}, el('a', { class: 'hm-proj pd-decided', href: projectHref(c) },
        el('span', { class: 'hm-av', text: initials(c.company || c.client_name || c.title) }),
        el('span', { class: 'hm-proj-main' }, el('strong', { text: c.title }), el('small', { text: [c.company, c.client_name].filter(Boolean).join(' · ') || '—' })),
        statusPill(c.status),
        el('span', { class: 'hm-proj-meta' }, el('b', { class: 'mono', text: price(c) }), el('small', { text: timeAgo(c.updated_at) }))))))) : null));
}

function dealCard(c) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(c.updated_at)) / 86400000));
  const move = el('select', { class: 'pd-move', 'aria-label': `Move ${c.title} to another stage`, title: 'Move to…', onchange: async (e) => { await saveContract(c.id, { status: e.target.value }, `Moved to ${STATUS[e.target.value].label}`); renderPending(); } },
    Object.entries(STATUS).map(([k, v]) => el('option', { value: k, text: v.label, selected: k === c.status ? true : null })));
  const li = el('li', { class: `pd-card${days >= 7 ? ' quiet' : ''}`, draggable: 'true', 'data-id': c.id },
    el('a', { class: 'pd-card-top', href: projectHref(c) },
      el('span', { class: 'hm-av', text: initials(c.company || c.client_name || c.title) }),
      el('span', { class: 'pd-card-main' }, el('strong', { text: c.title }), el('small', { text: [c.company, c.client_name].filter(Boolean).join(' · ') || c.client_email || 'No client yet' }))),
    el('div', { class: 'pd-card-mid' },
      el('b', { class: 'pd-price', text: price(c) }),
      el('span', { class: `pd-age${days >= 7 ? ' warn' : ''}`, title: 'Time since the last change', text: days ? `${days}d in stage` : 'Today' })),
    el('div', { class: 'pd-card-actions' },
      el('button', { type: 'button', class: 'pd-won', text: 'Won', title: 'Signed: make it a live project', onclick: async () => { await saveContract(c.id, { status: 'active' }, `${c.title} is live`); renderPending(); } }),
      armedButton('Lost', 'Sure?', async () => { await saveContract(c.id, { status: 'lost' }, 'Marked lost'); renderPending(); }, 'pd-lost'),
      move));
  li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  return li;
}

/* ------------------------------------------------------------------ */
/*  Requests: project inquiries                                        */
/* ------------------------------------------------------------------ */
async function loadInquiries() {
  const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
  if (error) { toast(`Couldn’t load inquiries: ${error.message}`, 'error'); return; }
  state.inquiries = data;
  if (state.selectedId && !data.some((q) => q.id === state.selectedId)) state.selectedId = null;
  renderTabs();
  renderList();
  if (state.selectedId) renderDetail(false);
  updateCounts();
}

function renderTabs() {
  const tabs = [['all', 'All'], ...INQ_STATUSES].map(([key, label]) =>
    el('button', {
      type: 'button', role: 'tab', class: 'tab', 'data-status': key,
      'aria-selected': String(state.filter === key),
      onclick: () => { state.filter = key; renderTabs(); renderList(); },
    }, label, el('span', { class: 'tab-count', 'data-inq-count': key })));
  $('#statusTabs').replaceChildren(...tabs);
  updateInqCounts();
}

function updateInqCounts() {
  const counts = { all: state.inquiries.length };
  for (const [key] of INQ_STATUSES) counts[key] = state.inquiries.filter((q) => q.status === key).length;
  $$('[data-inq-count]').forEach((n) => { n.textContent = counts[n.dataset.inqCount] ?? 0; });
}

$('#search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); renderList(); });

function visibleInquiries() {
  return state.inquiries.filter((q) => {
    if (state.filter !== 'all' && q.status !== state.filter) return false;
    if (!state.query) return true;
    return [q.name, q.email, q.company, q.message].some((s) => s && s.toLowerCase().includes(state.query));
  });
}

function renderList(flashId) {
  updateInqCounts();
  const rows = visibleInquiries();
  const items = rows.map((q) => {
    const files = Array.isArray(q.files) ? q.files.length : 0;
    return el('li', {},
      el('button', {
        type: 'button', class: 'inq-item', 'data-id': q.id,
        'aria-current': q.id === state.selectedId ? 'true' : null,
        onclick: () => select(q.id),
      },
        el('span', { class: 'inq-row' },
          el('strong', { class: 'inq-name', text: q.name }),
          el('time', { class: 'inq-time mono', datetime: q.created_at, text: timeAgo(q.created_at) })),
        el('span', { class: 'inq-sub', text: q.company ? `${q.company} · ${q.email}` : q.email }),
        el('span', { class: 'inq-snippet', text: q.message }),
        el('span', { class: 'inq-row' },
          el('span', { class: `status-pill s-${q.status}`, text: INQ_LABEL[q.status] || q.status }),
          files ? el('span', { class: 'inq-files mono', text: `${files} file${files === 1 ? '' : 's'}` }) : null)));
  });
  $('#inquiryList').replaceChildren(...items);
  $('#listEmpty').hidden = rows.length > 0;
  $('#listEmpty').textContent = state.inquiries.length
    ? 'Nothing matches this filter.'
    : 'No inquiries yet. Submissions from the website form land here automatically.';

  if (flashId && !REDUCED) {
    const node = $(`.inq-item[data-id="${flashId}"]`);
    if (node) gsap.fromTo(node, { backgroundColor: 'rgba(0,122,204,0.25)' }, { backgroundColor: 'rgba(0,122,204,0)', duration: 1.6, clearProps: 'backgroundColor' });
  }
}

function select(id) {
  state.selectedId = id;
  renderList();
  renderDetail();
  $('#adminMain').classList.add('show-detail');
}

function renderDetail(animate = true) {
  const detail = $('#detail');
  const q = state.inquiries.find((x) => x.id === state.selectedId);
  if (!q) {
    $('#adminMain').classList.remove('show-detail');
    detail.replaceChildren(el('div', { class: 'detail-empty' },
      el('p', { text: 'Select an inquiry to see details, files, and notes.' })));
    return;
  }

  const statusSelect = el('select', {
    class: 'status-select', id: 'statusSelect', 'aria-label': 'Status',
    onchange: (e) => updateStatus(q, e.target.value),
  }, INQ_STATUSES.map(([key, label]) => el('option', { value: key, selected: q.status === key ? true : null, text: label })));

  const deal = state.contracts.find((c) => c.inquiry_id === q.id);
  const dealBtn = deal
    ? el('a', { class: 'btn btn-ghost btn-sm', href: `#contract/${deal.id}`, text: 'Open deal →' })
    : el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Create deal', onclick: () => dealFromInquiry(q) });
  const deleteBtn = armedButton('Delete', 'Click again to delete', () => deleteInquiry(q), 'btn btn-ghost btn-sm danger');

  const meta = [
    ['Company', q.company],
    ['Phone', q.phone],
    ['Budget', q.budget],
    ['Timeline', q.timeline],
    ['Submitted', new Date(q.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })],
    ['Reference', `WS-${q.id.slice(0, 8).toUpperCase()}`],
  ];

  const files = Array.isArray(q.files) ? q.files : [];

  detail.replaceChildren(
    el('div', { class: 'detail-inner' },
      el('button', { type: 'button', class: 'detail-back', onclick: () => { state.selectedId = null; renderList(); renderDetail(); } }, '← All inquiries'),
      el('header', { class: 'detail-head' },
        el('div', {},
          el('h2', { text: q.name }),
          el('a', { class: 'detail-email', href: `mailto:${q.email}?subject=${encodeURIComponent('Re: your project inquiry')}`, text: q.email })),
        el('div', { class: 'detail-actions' }, dealBtn, statusSelect, deleteBtn)),

      el('dl', { class: 'meta-grid' },
        meta.map(([k, v]) => el('div', {}, el('dt', { class: 'mono', text: k }), el('dd', { text: v || '—' })))),

      q.services?.length
        ? el('div', { class: 'detail-block' },
            el('h3', { class: 'mono', text: 'Services' }),
            el('ul', { class: 'chips' }, q.services.map((s) => el('li', { text: s }))))
        : null,

      el('div', { class: 'detail-block' },
        el('h3', { class: 'mono', text: 'Project details' }),
        el('p', { class: 'message', text: q.message })),

      el('div', { class: 'detail-block' },
        el('h3', { class: 'mono', text: `Files (${files.length})` }),
        files.length
          ? el('ul', { class: 'detail-files', id: 'detailFiles' }, files.map((f) =>
              el('li', { 'data-path': f.path },
                el('span', { class: 'thumb' }, el('span', { class: 'file-ext', text: (f.name.split('.').pop() || 'file').slice(0, 4) })),
                el('span', { class: 'file-info' },
                  el('span', { class: 'file-name', text: f.name, title: f.name }),
                  el('span', { class: 'file-meta', text: formatBytes(f.size) })),
                el('a', { class: 'btn btn-ghost btn-sm file-open', target: '_blank', rel: 'noopener', 'aria-disabled': 'true', text: 'Open' }))))
          : el('p', { class: 'muted', text: 'No files attached.' })),

      el('div', { class: 'detail-block notes' },
        el('h3', { class: 'mono', text: 'Team notes' }),
        el('ul', { class: 'note-list', id: 'noteList' }, el('li', { class: 'muted', text: 'Loading notes…' })),
        el('form', { class: 'note-form', id: 'noteForm', onsubmit: (e) => { e.preventDefault(); addNote(q.id); } },
          el('textarea', { name: 'body', rows: '3', maxlength: '5000', placeholder: 'Add a note — call summary, next steps, pricing… (Ctrl+Enter to save)', 'aria-label': 'New note', onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(q.id); } } }),
          el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Save note'))),
    ),
  );

  detail.scrollTop = 0;

  loadFileLinks(q);
  loadNotes(q.id);
}

function dealFromInquiry(q) {
  contractForm({
    title: q.services?.length ? q.services.join(' + ') : `Project for ${q.company || q.name}`,
    client_name: q.name, client_email: q.email, company: q.company, scope: q.message,
    status: 'proposal', inquiry_id: q.id,
  }, {
    title: 'Turn this inquiry into a deal',
    onSaved: async (d) => {
      upsertContract(d);
      if (q.status === 'new') await updateStatus(q, 'in_progress', false);
      location.hash = projectHref(d);
    },
  });
}

function syncStatusSelect(status) {
  const sel = $('#statusSelect');
  if (sel) sel.value = status;
}

async function updateStatus(q, status, say = true) {
  const prev = q.status;
  q.status = status;
  renderList();
  const { error } = await supabase.from('inquiries').update({ status }).eq('id', q.id);
  if (error) {
    q.status = prev;
    syncStatusSelect(prev);
    renderList();
    toast(`Couldn’t save status: ${error.message}`, 'error');
  } else if (say) toast(`Status set to ${INQ_LABEL[status]}`);
  updateCounts();
}

async function deleteInquiry(q) {
  const paths = (q.files || []).map((f) => f.path);
  if (paths.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) { toast(`Couldn’t delete files: ${error.message}`, 'error'); return; }
  }
  const { error } = await supabase.from('inquiries').delete().eq('id', q.id);
  if (error) { toast(`Couldn’t delete: ${error.message}`, 'error'); return; }
  state.inquiries = state.inquiries.filter((x) => x.id !== q.id);
  state.selectedId = null;
  renderList();
  renderDetail();
  updateCounts();
  toast('Inquiry deleted');
}

/** Private files are served through short-lived signed URLs. */
async function loadFileLinks(q) {
  const files = Array.isArray(q.files) ? q.files : [];
  if (!files.length) return;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 60 * 60);
  if (state.selectedId !== q.id) return;
  if (error) { toast(`Couldn’t load file links: ${error.message}`, 'error'); return; }
  data.forEach((entry, i) => {
    const row = document.querySelector(`#detailFiles li[data-path="${CSS.escape(files[i].path)}"]`);
    if (!row || !entry.signedUrl) return;
    const link = row.querySelector('.file-open');
    link.href = entry.signedUrl;
    link.removeAttribute('aria-disabled');
    if ((files[i].type || '').startsWith('image/')) {
      const img = el('img', { src: entry.signedUrl, alt: '', loading: 'lazy' });
      row.querySelector('.thumb').replaceChildren(img);
    }
  });
}

/* ---------- team notes on an inquiry ---------- */
async function loadNotes(inquiryId) {
  const { data, error } = await supabase
    .from('inquiry_notes')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });
  if (state.selectedId !== inquiryId) return;
  if (error) { toast(`Couldn’t load notes: ${error.message}`, 'error'); return; }
  state.notes = data;
  renderNotes();
}

function renderNotes() {
  const list = $('#noteList');
  if (!list) return;
  if (!state.notes.length) {
    list.replaceChildren(el('li', { class: 'muted', text: 'No notes yet.' }));
    return;
  }
  list.replaceChildren(...state.notes.map(noteItem));
}

function noteItem(note) {
  const edited = new Date(note.updated_at) - new Date(note.created_at) > 1000;
  const li = el('li', { class: 'note', 'data-id': note.id },
    el('div', { class: 'note-meta mono' },
      el('span', { text: note.author_email || 'Team' }),
      el('span', { text: `${timeAgo(note.created_at)}${edited ? ' · edited' : ''}` })),
    el('p', { class: 'note-body', text: note.body }),
    el('div', { class: 'note-actions' },
      el('button', { type: 'button', class: 'link-btn', onclick: () => editNote(li, note) }, 'Edit'),
      armedButton('Delete', 'Confirm delete', () => deleteNote(note), 'link-btn danger')));
  return li;
}

function editNote(li, note) {
  const area = el('textarea', { rows: '3', maxlength: '5000', 'aria-label': 'Edit note' });
  area.value = note.body;
  const save = async () => {
    const body = area.value.trim();
    if (!body) { toast('A note can’t be empty', 'error'); return; }
    if (body === note.body) { renderNotes(); return; }
    const { data, error } = await supabase.from('inquiry_notes').update({ body }).eq('id', note.id).select().single();
    if (error) { toast(`Couldn’t save note: ${error.message}`, 'error'); return; }
    state.notes = state.notes.map((n) => (n.id === note.id ? data : n));
    renderNotes();
    toast('Note updated');
  };
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    if (e.key === 'Escape') renderNotes();
  });
  li.querySelector('.note-body').replaceWith(area);
  li.querySelector('.note-actions').replaceChildren(
    el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: save }, 'Save'),
    el('button', { type: 'button', class: 'link-btn', onclick: renderNotes }, 'Cancel'));
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
}

async function addNote(inquiryId) {
  const form = $('#noteForm');
  const area = form.body;
  const body = area.value.trim();
  if (!body) { area.focus(); return; }
  const btn = form.querySelector('button');
  btn.disabled = true;
  const { data, error } = await supabase.from('inquiry_notes').insert({ inquiry_id: inquiryId, body }).select().single();
  btn.disabled = false;
  if (error) { toast(`Couldn’t save note: ${error.message}`, 'error'); return; }
  if (state.selectedId !== inquiryId) return;
  area.value = '';
  state.notes.push(data);
  renderNotes();
  const added = $(`.note[data-id="${data.id}"]`);
  if (added && !REDUCED) gsap.from(added, { y: 10, autoAlpha: 0, duration: 0.4, ease: 'power3.out' });
  toast('Note saved');
}

async function deleteNote(note) {
  const { error } = await supabase.from('inquiry_notes').delete().eq('id', note.id);
  if (error) { toast(`Couldn’t delete note: ${error.message}`, 'error'); return; }
  state.notes = state.notes.filter((n) => n.id !== note.id);
  renderNotes();
  toast('Note deleted');
}

function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Keep relative times fresh.
setInterval(() => { if (state.view === 'requests') renderList(); }, 60_000);

/* ------------------------------------------------------------------ */
/*  Requests: account requests and invites                             */
/*  Accounts are invite only. An invite is tied to an email; its link  */
/*  opens signup.html, and the database refuses any new account whose  */
/*  email has no open invite.                                          */
/* ------------------------------------------------------------------ */
const SITE = new URL('./', location.href).href;
const inviteUrl = (token) => `${SITE}signup.html?invite=${token}`;
const inviteMail = (email, token) => `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your Williams Systems account')}&body=${encodeURIComponent(`Hi,\n\nHere's your invite to create your Williams Systems account:\n${inviteUrl(token)}\n\nSee you inside,\nLandon`)}`;
const access = { requests: [], invites: [] };

$$('.admin-view').forEach((b) => b.addEventListener('click', () => {
  history.replaceState(null, '', b.dataset.view === 'access' ? '#requests/accounts' : '#requests');
  switchRequests(b.dataset.view);
}));
function switchRequests(view) {
  $$('.admin-view').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  $('#adminMain').hidden = view !== 'inbox';
  $('#accessView').hidden = view !== 'access';
  if (view === 'access') loadAccess();
}

async function loadAccess() {
  const [req, inv] = await Promise.all([
    supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('invites').select('*').is('accepted_at', null).order('created_at', { ascending: false }),
  ]);
  if (req.error || inv.error) return toast(`Couldn’t load access: ${(req.error || inv.error).message}`, 'error');
  access.requests = req.data;
  state.requests = req.data;
  access.invites = inv.data;
  renderRequests();
  renderInvites();
  updateCounts();
}

function renderInvites() {
  $('#inviteList').replaceChildren(...access.invites.map((i) => el('li', { class: 'access-item' },
    el('div', { class: 'access-who' },
      el('b', { text: i.email }),
      el('span', { class: 'access-meta', text: `${i.role === 'owner' ? 'Owner' : 'Client'} · invited ${new Date(i.created_at).toLocaleDateString()}` })),
    el('div', { class: 'access-actions' },
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Copy link', onclick: () => copy(inviteUrl(i.token)) }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Revoke', onclick: () => revoke(i) })))));
  $('#inviteEmpty').hidden = access.invites.length > 0;
}

function renderRequests() {
  $('#requestList').replaceChildren(...access.requests.map((r) => {
    const deal = state.contracts.find((c) => c.request_id === r.id);
    return el('li', { class: `access-item ${r.status}` },
      el('div', { class: 'access-who' },
        el('b', { text: r.name }),
        el('span', { class: 'access-meta', text: [r.email, r.company].filter(Boolean).join(' · ') }),
        r.message ? el('p', { class: 'access-msg', text: r.message }) : null,
        el('span', { class: 'access-meta', text: `${new Date(r.created_at).toLocaleString()}${r.status !== 'new' ? ` · ${r.status}` : ''}` })),
      el('div', { class: 'access-actions' },
        r.status === 'new' ? el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Invite', onclick: () => invite(r.email, 'client', r) }) : null,
        deal ? el('a', { class: 'btn btn-ghost btn-sm', href: `#contract/${deal.id}`, text: 'Open deal →' })
          : el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Create deal', onclick: () => contractForm(
            { title: `Project for ${r.company || r.name}`, client_name: r.name, client_email: r.email, company: r.company, scope: r.message, status: 'proposal', request_id: r.id },
            { title: 'Turn this request into a deal', onSaved: (d) => { upsertContract(d); location.hash = projectHref(d); } }) }),
        r.status === 'new' ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Decline', onclick: () => setRequest(r, 'declined') }) : null));
  }));
  $('#requestEmpty').hidden = access.requests.length > 0;
}

$('#inviteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const email = f.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid email.', 'error');
  invite(email, f.role.value).then((ok) => { if (ok) f.reset(); });
});

async function invite(email, role, request) {
  // one open invite per email: reuse it if there is one
  let row = access.invites.find((i) => i.email.toLowerCase() === email.toLowerCase());
  if (!row) {
    const { data, error } = await supabase.from('invites').insert({ email, role, invited_by: state.me.id }).select().single();
    if (error) { toast(`Couldn’t create the invite: ${error.message}`, 'error'); return false; }
    row = data;
  }
  if (request) await setRequest(request, 'invited', false);
  $('#invitedEmail').textContent = row.email;
  $('#inviteLink').value = inviteUrl(row.token);
  $('#mailInvite').href = inviteMail(row.email, row.token);
  $('#inviteResult').hidden = false;
  toast('Invite ready. Send them the link.');
  await loadAccess();
  return true;
}

async function setRequest(r, status, reload = true) {
  const { error } = await supabase.from('access_requests').update({ status }).eq('id', r.id);
  if (error) return toast(`Couldn’t update: ${error.message}`, 'error');
  if (reload) loadAccess();
}

async function revoke(i) {
  if (!confirm(`Revoke the invite for ${i.email}? Their link will stop working.`)) return;
  const { error } = await supabase.from('invites').delete().eq('id', i.id);
  if (error) return toast(`Couldn’t revoke: ${error.message}`, 'error');
  toast('Invite revoked');
  loadAccess();
}

$('#copyInvite').addEventListener('click', () => copy($('#inviteLink').value));
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copied'); }
  catch { $('#inviteLink').value = text; $('#inviteLink').select(); toast('Press Ctrl+C to copy', 'error'); }
}
