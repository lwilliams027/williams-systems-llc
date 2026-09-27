/* =====================================================================
   A project (one contract) and its sections:
     Overview   stage, scope of work, deliverables, details, timeline
     Tickets    the client's requests, each with files and a thread
     Chat       the live conversation between owner and client
     Schedule   meetings, calls, deadlines (with Join links)
     Files      everything uploaded on this project's tickets

   Each has its own address: #/<project>/<section>, e.g. #/booking-website/tickets
   and #/booking-website/tickets/12 for ticket #12.

   Owners (owner: true) can edit everything. Clients see the same pages
   read-only, except chat and tickets. The database enforces that either way.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import {
  el, $, $$, REDUCED, STATUS, PENDING, statusPill, money, price, fmtDate, fmtTime, timeAgo, dueText,
  toast, armedButton, modal, field, icon, initials, EVENT_KINDS, ymd, day, fill, add, richText, meetingName, formatBytes,
} from './util.js';
import { ticketRows, ticketForm, ticketView, fileList, OPEN_STATES } from './tickets.js';
import { chatBubble } from './chat-bubble.js';
import { calendarView } from './calendar.js';

const SITE = new URL('./', location.href).href;
export const SECTIONS = [
  ['overview', 'Overview'],
  ['tickets', 'Tickets'],
  ['schedule', 'Schedule'],
  ['files', 'Files'],
];
export const projectHref = (c, section = 'overview', sub) =>
  `#/${c.slug || c.id}${section === 'overview' ? '' : `/${section}`}${sub ? `/${sub}` : ''}`;

/**
 * Render a project section into `root`. Returns a cleanup function.
 * opts: { id | slug, section?, sub?, owner, me: { id }, onChanged?, onDeleted?, onRead?, addEvent?, clientLabel? }
 */
export async function contractPage(root, opts) {
  const { owner } = opts;
  // old links to …/chat open the overview with the chat bubble popped up
  const wantChat = opts.section === 'chat';
  const section = SECTIONS.some(([k]) => k === opts.section) ? opts.section : 'overview';
  fill(root, el('div', { class: 'cv-loading', text: 'Loading…' }));

  const q = supabase.from('contracts').select('*');
  const c = await (opts.slug ? q.eq('slug', opts.slug) : q.eq('id', opts.id)).maybeSingle();
  if (c.error || !c.data) {
    fill(root, el('div', { class: 'cv-missing' },
      el('h2', { text: 'This project isn’t available.' }),
      el('p', { text: c.error ? c.error.message : 'It may have been renamed or removed.' })));
    return () => {};
  }
  const id = c.data.id;
  const [msgs, evs, acts, tks] = await Promise.all([
    { data: [] },
    supabase.from('events').select('*').eq('contract_id', id).order('starts_at'),
    section === 'overview' ? supabase.from('activity').select('*').eq('contract_id', id).order('created_at', { ascending: false }).limit(60) : { data: [] },
    supabase.from('tickets').select('*').eq('contract_id', id).order('updated_at', { ascending: false }),
  ]);
  const s = { c: c.data, msgs: msgs.data || [], evs: evs.data || [], acts: acts.data || [], tks: tks.data || [] };
  const href = (sec, sub) => projectHref(s.c, sec, sub);
  const chatBox = chatBubble({ contract: s.c, owner, me: opts.me, onRead: opts.onRead });
  if (wantChat) setTimeout(() => chatBox.open(), 50);

  const head = el('div');
  const tabs = el('nav', { class: 'cv-tabs', 'aria-label': 'Project sections' });
  const body = el('div', { class: `cv-body cv-${section}` });
  const rail = el('aside', { class: 'pv-rail', 'aria-label': owner ? 'Client and project details' : 'Your project details' });
  const withRail = !['tickets', 'schedule'].includes(section);   // these two need the full width
  fill(root, el('article', { class: `cv${owner ? ' is-owner' : ''}` }, head, tabs, withRail ? el('div', { class: 'pv' }, body, rail) : body));

  const save = async (patch, msg) => {
    const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single();
    if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return false; }
    s.c = data;
    renderHead(); renderSection();
    opts.onChanged?.(data);
    if (msg) toast(msg);
    return true;
  };

  /* ---------- header + section tabs ---------- */
  const STAGE_WORDS = { proposal: 'Proposal', negotiating: 'Negotiating', awaiting_signature: 'Awaiting signature', active: 'In progress', on_hold: 'On hold', complete: 'Complete', lost: 'Lost' };
  function renderHead() {
    const c = s.c;
    const line = [
      STAGE_WORDS[c.status],
      ['active', 'on_hold'].includes(c.status) ? `${c.progress}% done` : null,
      c.due_date && !['complete', 'lost'].includes(c.status) ? dueText(c) : null,
    ].filter(Boolean).join(' · ');
    fill(head, el('header', { class: 'cv-head pv-head' },
      el('p', { class: 'cv-kicker mono', text: c.company || c.client_name || (owner ? 'No client yet' : 'Your project') }),
      el('h1', { text: c.title }),
      el('p', { class: `pv-line${dueClass(c) ? ' late' : ''}`, text: line })));
    renderTabs();
    renderRail();
  }

  /* ---------- the sidebar: client (or, for clients, their contact) + project facts ---------- */
  function renderRail() {
    if (!withRail) return;
    const c = s.c;
    const person = owner
      ? { name: c.client_name || c.client_email || 'No client yet', sub: c.company || (c.client_email && c.client_name ? null : ''), email: c.client_email }
      : { name: 'Landon Williams', sub: 'Williams Systems LLC', email: 'lwilliams@williamssystems.dev', phone: '(810) 214-5388' };
    const portal = owner
      ? (c.client_id
        ? el('p', { class: 'pv-portal ok' }, el('i'), 'Portal active')
        : c.client_email
          ? el('div', { class: 'pv-portal-row' }, el('p', { class: 'pv-portal warn' }, el('i'), 'Hasn’t signed up yet'),
            el('button', { type: 'button', class: 'link-btn pv-invite', text: 'Invite', onclick: () => inviteClient(c.client_email) }))
          : el('p', { class: 'pv-portal' }, el('i'), 'No email on file'))
      : null;

    const client = el('section', { class: 'pv-card' },
      el('h2', { class: 'pv-h', text: owner ? 'Client' : 'Your contact' }),
      el('div', { class: 'pv-person' },
        el('span', { class: 'hm-av', text: initials(person.name) }),
        el('div', {}, el('strong', { text: person.name }), person.sub ? el('small', { text: person.sub }) : null)),
      person.email || person.phone ? el('ul', { class: 'pv-contact' },
        person.email ? el('li', {}, el('a', { href: `mailto:${person.email}`, text: person.email })) : null,
        person.phone ? el('li', {}, el('a', { href: `tel:+1${person.phone.replace(/\D/g, '')}`, text: person.phone })) : null) : null,
      portal,
      el('div', { class: 'pv-actions' },
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: owner ? 'Message' : 'Message Landon', onclick: () => chatBox.open() }),
        person.email ? el('a', { class: 'btn btn-ghost btn-sm', href: `mailto:${person.email}`, text: 'Email' }) : null));

    const stage = owner
      ? el('select', { class: 'pv-select', 'aria-label': 'Stage', onchange: (e) => save({ status: e.target.value }, `Moved to ${STATUS[e.target.value].label}`) },
        Object.entries(STATUS).map(([k, v]) => el('option', { value: k, selected: k === c.status ? true : null, text: STAGE_WORDS[k] || v.label })))
      : el('span', { text: STAGE_WORDS[c.status] });
    const bar = el('div', { class: 'pv-progress' },
      el('div', { class: 'pv-progress-top' }, el('span', { text: 'Progress' }), el('b', { text: `${c.progress}%` })),
      el('div', { class: 'hm-bar' }, el('i', { style: { width: `${c.progress}%` } })));
    if (owner) {
      const range = el('input', { type: 'range', min: 0, max: 100, step: 5, value: c.progress, 'aria-label': 'Progress' });
      range.addEventListener('input', () => { bar.querySelector('b').textContent = `${range.value}%`; bar.querySelector('.hm-bar i').style.width = `${range.value}%`; });
      range.addEventListener('change', () => save({ progress: Number(range.value) }, 'Progress saved'));
      bar.append(range);
    }
    const facts = el('section', { class: 'pv-card' },
      el('h2', { class: 'pv-h', text: 'Project' }),
      el('dl', { class: 'pv-facts' },
        el('div', {}, el('dt', { text: 'Stage' }), el('dd', {}, stage)),
        el('div', {}, el('dt', { text: 'Price' }), el('dd', { class: 'mono', text: price(c) })),
        el('div', {}, el('dt', { text: 'Billing' }), el('dd', { text: c.billing === 'monthly' ? 'Monthly plan' : 'One-time project' })),
        el('div', {}, el('dt', { text: 'Start' }), el('dd', { text: fmtDate(c.start_date) })),
        el('div', {}, el('dt', { text: 'Due' }), el('dd', { class: dueClass(c), text: fmtDate(c.due_date) }))),
      bar,
      owner ? el('div', { class: 'pv-manage' },
      el('button', { type: 'button', class: 'link-btn', text: 'Edit details', onclick: () => contractForm(c, { onSaved: (d) => { s.c = d; renderHead(); renderSection(); opts.onChanged?.(d); } }) }),
      armedButton('Delete project', 'Click again to delete', async () => {
        const { error } = await supabase.from('contracts').delete().eq('id', id);
        if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
        toast('Contract deleted');
        opts.onDeleted?.();
      }, 'link-btn danger')) : null);

    fill(rail, client, facts);
  }

  function renderTabs() {
    const open = s.tks.filter((t) => OPEN_STATES.includes(t.status)).length;
    const upcoming = s.evs.filter((e) => new Date(e.starts_at) >= new Date(new Date().setHours(0, 0, 0, 0))).length;
    const counts = { tickets: open, schedule: upcoming };
    opts.onCounts?.(s.c, counts);
    fill(tabs, SECTIONS.map(([k, label]) => el('a', { href: href(k), class: 'cv-tab', 'aria-current': k === section ? 'page' : 'false' },
      label, counts[k] ? el('span', { class: 'cv-tab-n', text: counts[k] }) : null)));
  }

  function renderSection() {
    if (section === 'overview') return overview();
    if (section === 'tickets') return ticketsSection();
    if (section === 'schedule') return scheduleSection();
    if (section === 'files') return filesSection();
  }

  /* =====================================================================
     Overview — the whole project on one screen, with charts
     ===================================================================== */
  const slots = {};
  const DAY = 86400000;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  let scopeOpen = false, scopeEditing = false, showAllHistory = false;
  const card = (title, bodyNodes, { link, extra, cls = '' } = {}) => el('section', { class: `cv-card ov-card ${cls}` },
    el('div', { class: 'cv-card-head' }, el('h2', { text: title }), extra || null, link ? el('a', { class: 'crm-more', href: link[1], text: link[0] }) : null),
    bodyNodes);

  function overview() {
    const c = s.c;
    const items = Array.isArray(c.deliverables) ? c.deliverables : [];
    const done = items.filter((d) => d.done).length;
    const today0 = new Date(new Date().setHours(0, 0, 0, 0));
    const start = c.start_date ? day(c.start_date) : null;
    const due = c.due_date ? day(c.due_date) : null;
    const timePct = start && due && due > start ? clamp(Math.round(((today0 - start) / (due - start)) * 100), 0, 100) : null;
    const daysLeft = due ? Math.round((due - today0) / DAY) : null;
    const closed = ['complete', 'lost'].includes(c.status);
    const pace = timePct == null || closed || PENDING.includes(c.status) ? null
      : c.progress >= timePct - 10 ? ['on', 'On track'] : c.progress >= timePct - 25 ? ['tight', 'Cutting it close'] : ['behind', 'Behind schedule'];
    const openT = s.tks.filter((t) => OPEN_STATES.includes(t.status));
    const upcoming = s.evs.filter((e) => e.status !== 'declined' && new Date(e.starts_at) >= today0);

    /* ---------- the four numbers ---------- */
    const ring = (() => {
      const R = 22, C = 2 * Math.PI * R, pct = clamp(c.progress, 0, 100);
      const svg = el('svg', { class: 'ov-ring', viewBox: '0 0 56 56', 'aria-hidden': 'true' },
        el('defs', { html: '<linearGradient id="ovRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E9BFF"/><stop offset="1" stop-color="#A06BFF"/></linearGradient>' }),
        el('circle', { cx: 28, cy: 28, r: R, class: 'ov-ring-track' }),
        el('circle', { cx: 28, cy: 28, r: R, class: 'ov-ring-fill', 'stroke-dasharray': `${(pct / 100) * C} ${C}`, transform: 'rotate(-90 28 28)' }));
      return svg;
    })();
    const segs = el('div', { class: 'ov-segs', 'aria-hidden': 'true' },
      (items.length ? items : [{}]).map((d) => el('i', { class: d.done ? 'on' : '' })));
    const timeValue = c.billing === 'monthly' && !due ? 'Ongoing'
      : daysLeft == null ? '—'
      : closed ? fmtDate(c.due_date, { month: 'short', day: 'numeric' })
      : daysLeft > 0 ? `${daysLeft}` : daysLeft === 0 ? 'Today' : `${-daysLeft}`;
    const timeLabel = c.billing === 'monthly' && !due ? 'Monthly plan'
      : daysLeft == null ? 'No due date' : closed ? 'Was due' : daysLeft > 0 ? `day${daysLeft === 1 ? '' : 's'} left` : daysLeft === 0 ? 'Due today' : `day${daysLeft === -1 ? '' : 's'} overdue`;
    const stats = el('section', { class: 'ov-stats' },
      el('div', { class: 'ov-stat' }, ring,
        el('div', {}, el('b', { text: `${c.progress}%` }), el('span', { text: 'Work done' }))),
      el('div', { class: 'ov-stat' },
        el('div', { class: 'ov-stat-col' }, el('div', {}, el('b', { text: items.length ? `${done}/${items.length}` : '—' }), el('span', { text: 'Deliverables' })), segs)),
      el('div', { class: `ov-stat${daysLeft != null && daysLeft < 0 && !closed ? ' late' : ''}` },
        el('div', { class: 'ov-stat-col' }, el('div', {}, el('b', { text: timeValue }), el('span', { text: timeLabel })),
          timePct != null ? el('div', { class: 'ov-minibar', title: `${timePct}% of the time used` }, el('i', { style: { width: `${timePct}%` } })) : null)),
      el('a', { class: 'ov-stat', href: href('tickets') },
        el('div', { class: 'ov-stat-col' }, el('div', {}, el('b', { text: String(openT.length) }), el('span', { text: owner ? 'Open tickets' : 'Open requests' })),
          el('small', { text: openT.length ? [openT.filter((t) => t.status === 'open').length ? `${openT.filter((t) => t.status === 'open').length} new` : null, openT.filter((t) => t.status === 'waiting').length ? `${openT.filter((t) => t.status === 'waiting').length} waiting` : null].filter(Boolean).join(' · ') || 'In progress' : 'All clear' }))));

    /* ---------- timeline chart: start → due, today, events; time used vs work done ---------- */
    const steps = ['Proposal', 'Signed', 'In progress', 'Complete'];
    const at = c.status === 'lost' ? -1 : PENDING.includes(c.status) ? 0 : c.status === 'complete' ? 3 : c.progress > 0 ? 2 : 1;
    const stageStrip = el('ol', { class: 'ov-steps', 'aria-label': 'Project stage' }, steps.map((t, i) =>
      el('li', { class: i < at ? 'done' : i === at ? 'now' : '' }, el('i'), el('span', { text: i === 2 && c.status === 'on_hold' ? 'On hold' : t }))));
    let track;
    if (start && due && due > start) {
      const pos = (d) => clamp(((d - start) / (due - start)) * 100, 0, 100);
      const inRange = s.evs.filter((e) => { const d = new Date(e.starts_at); return e.status === 'confirmed' && d >= start && d <= new Date(due.getTime() + DAY); });
      track = el('div', { class: 'ov-track' },
        el('div', { class: 'ov-track-bar' },
          el('i', { class: 'ov-track-used', style: { width: `${timePct}%` } }),
          inRange.map((e) => el('span', { class: `ov-track-ev k-${e.kind}`, style: { left: `${pos(new Date(e.starts_at))}%` }, title: `${e.title} · ${fmtDate(e.starts_at, { month: 'short', day: 'numeric' })}` })),
          today0 >= start && today0 <= due ? el('span', { class: 'ov-today', style: { left: `${timePct}%` } }, el('em', { text: 'Today' })) : null),
        el('div', { class: 'ov-track-ends' },
          el('span', { text: `Start ${fmtDate(c.start_date, { month: 'short', day: 'numeric' })}` }),
          el('span', { text: `Due ${fmtDate(c.due_date, { month: 'short', day: 'numeric' })}` })));
    } else {
      track = el('p', { class: 'ov-quiet' }, c.billing === 'monthly' ? 'Monthly plan: no fixed end date.' : 'Add a start and due date to see the timeline.',
        owner && c.billing !== 'monthly' ? el('button', { type: 'button', class: 'link-btn', text: ' Set dates', onclick: () => contractForm(c, { onSaved: (d) => { s.c = d; renderHead(); renderSection(); opts.onChanged?.(d); } }) }) : null);
    }
    const compare = timePct != null ? el('div', { class: 'ov-compare' },
      el('div', { class: 'ov-cmp' }, el('span', { text: 'Time used' }), el('div', { class: 'ov-cmp-bar time' }, el('i', { style: { width: `${timePct}%` } })), el('b', { class: 'mono', text: `${timePct}%` })),
      el('div', { class: 'ov-cmp' }, el('span', { text: 'Work done' }), el('div', { class: 'ov-cmp-bar work' }, el('i', { style: { width: `${c.progress}%` } })), el('b', { class: 'mono', text: `${c.progress}%` }))) : null;
    const timeline = card('Timeline', [stageStrip, track, compare], {
      cls: 'ov-timeline',
      extra: pace ? el('span', { class: `ov-pace ${pace[0]}`, text: pace[1] }) : c.status === 'lost' ? el('span', { class: 'ov-pace behind', text: 'Lost' }) : null,
    });

    /* ---------- deliverables (compact checklist) ---------- */
    const setList = (next, msg) => save({ deliverables: next, ...(next.length ? { progress: c.status === 'complete' ? 100 : Math.round((next.filter((d) => d.done).length / next.length) * 100) } : {}) }, msg);
    const input = el('input', { type: 'text', maxlength: 200, placeholder: 'Add a deliverable…', 'aria-label': 'New deliverable' });
    const addItem = () => { const t = input.value.trim(); if (t) setList([...items, { text: t, done: false }]); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });
    const deliverables = card('Deliverables', [
      items.length ? el('ul', { class: 'ov-checks' }, items.map((d, i) => el('li', { class: d.done ? 'done' : '' },
        el('label', {},
          el('input', { type: 'checkbox', checked: d.done ? true : null, disabled: owner ? null : true, onchange: (e) => setList(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x))) }),
          el('span', { text: d.text })),
        d.ticket ? el('a', { class: 'cv-from-ticket mono', href: href('tickets', d.ticket), text: `#${d.ticket}` }) : null,
        owner ? el('button', { type: 'button', class: 'cv-x', 'aria-label': `Remove ${d.text}`, html: '&times;', onclick: () => setList(items.filter((_, j) => j !== i)) }) : null)))
        : el('p', { class: 'ov-quiet', text: owner ? 'Break the work into deliverables. Ticking them off moves the progress.' : 'Deliverables will be listed here as the project takes shape.' }),
      owner ? el('div', { class: 'ov-add' }, input, el('button', { type: 'button', class: 'cv-add-btn', 'aria-label': 'Add deliverable', html: icon.plus, onclick: addItem })) : null,
    ], { cls: 'ov-deliv', extra: items.length ? el('span', { class: 'cv-count mono', text: `${done}/${items.length}` }) : null });

    /* ---------- coming up ---------- */
    const soon = card('Coming up', upcoming.length
      ? el('ul', { class: 'ov-events' }, upcoming.slice(0, 3).map((e) => el('li', { class: `k-${e.kind}` },
        el('span', { class: 'hm-date' }, el('small', { text: new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short' }) }), el('b', { text: new Date(e.starts_at).getDate() })),
        el('span', { class: 'ov-ev-main' }, el('strong', { text: e.title }), el('small', { text: `${e.all_day ? EVENT_KINDS[e.kind] : `${new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short' })} · ${fmtTime(e.starts_at)}`}${e.status === 'requested' ? ' · requested' : ''}` })),
        e.link ? el('a', { class: 'hm-join', href: e.link, target: '_blank', rel: 'noopener noreferrer', text: 'Join' }) : null)))
      : el('p', { class: 'ov-quiet', text: 'Nothing scheduled.' }), { link: ['Schedule →', href('schedule')] });

    /* ---------- tickets: a bar by status + the latest open ones ---------- */
    const TK = [['open', 'New', '#7CB7FF'], ['in_progress', 'In progress', '#A06BFF'], ['waiting', owner ? 'Waiting on client' : 'Waiting on you', '#F5B84B'], ['resolved', 'Resolved', '#3DDC84']];
    const counts = TK.map(([k, label, color]) => ({ k, label, color, n: s.tks.filter((t) => (k === 'resolved' ? ['resolved', 'closed'].includes(t.status) : t.status === k)).length }));
    const total = counts.reduce((a, x) => a + x.n, 0);
    const tickets = card(owner ? 'Tickets' : 'Your requests', [
      total ? el('div', { class: 'ov-stack', role: 'img', 'aria-label': counts.map((x) => `${x.label}: ${x.n}`).join(', ') },
        counts.filter((x) => x.n).map((x) => el('i', { style: { flex: x.n, background: x.color }, title: `${x.label}: ${x.n}` }))) : null,
      total ? el('ul', { class: 'ov-legend' }, counts.filter((x) => x.n).map((x) => el('li', {}, el('i', { style: { background: x.color } }), x.label, el('b', { text: x.n })))) : null,
      openT.length ? el('ul', { class: 'ov-tks' }, openT.slice(0, 2).map((t) => el('li', {}, el('a', { href: href('tickets', t.number) },
        el('span', { class: 'mono', text: `#${t.number}` }), el('span', { class: 'ov-tk-title', text: t.title }))))) : null,
      !total ? el('p', { class: 'ov-quiet', text: owner ? 'No tickets yet.' : 'Need a change or found a bug? Send a request.' }) : null,
      c.status !== 'lost' ? el('button', { type: 'button', class: 'link-btn ov-new', text: owner ? '+ New ticket' : '+ New request', onclick: newTicket }) : null,
    ], { link: ['All →', href('tickets')] });

    /* ---------- scope (preview) + history ---------- */
    let scopeBody;
    if (scopeEditing) {
      const area = el('textarea', { class: 'cv-textarea', rows: 10, maxlength: 20000, 'aria-label': 'Scope of work' });
      area.value = c.scope || '';
      scopeBody = [area, el('div', { class: 'cv-row-end' },
        el('button', { type: 'button', class: 'link-btn', text: 'Cancel', onclick: () => { scopeEditing = false; overview(); } }),
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Save', onclick: async () => { scopeEditing = false; await save({ scope: area.value.trim() || null }, 'Scope saved'); } }))];
      setTimeout(() => area.focus(), 0);
    } else {
      scopeBody = [c.scope ? richText(c.scope, 'div', { class: `cv-scope ov-scope${scopeOpen ? ' open' : ''}` })
        : el('p', { class: 'ov-quiet', text: owner ? 'No scope written yet.' : 'Your scope of work will appear here.' }),
      c.scope && c.scope.split('\n').length + c.scope.length / 90 > 6 ? el('button', { type: 'button', class: 'link-btn ov-new', text: scopeOpen ? 'Show less' : 'Read all', onclick: () => { scopeOpen = !scopeOpen; overview(); } }) : null];
    }
    const scope = card('Scope of work', scopeBody, {
      cls: 'ov-scope-card',
      extra: owner && !scopeEditing ? el('button', { type: 'button', class: 'link-btn', text: c.scope ? 'Edit' : 'Write it', onclick: () => { scopeEditing = true; overview(); } }) : null,
    });
    const PREVIEW = 4;
    const hist = showAllHistory ? s.acts : s.acts.slice(0, PREVIEW);
    const history = card('Recent activity', [
      s.acts.length ? el('ol', { class: 'cv-timeline' }, hist.map((a) => el('li', { class: `t-${a.kind}` },
        el('i'), el('span', { text: a.summary }), el('time', { class: 'mono', datetime: a.created_at, title: new Date(a.created_at).toLocaleString(), text: timeAgo(a.created_at) }))))
        : el('p', { class: 'ov-quiet', text: 'Updates will show up here.' }),
      s.acts.length > PREVIEW ? el('button', { type: 'button', class: 'link-btn ov-new', text: showAllHistory ? 'Show less' : `Show all ${s.acts.length}`, onclick: () => { showAllHistory = !showAllHistory; overview(); } }) : null,
    ]);

    fill(body, el('div', { class: 'ov' },
      stats,
      el('div', { class: 'ov-row ov-row-a' }, timeline, deliverables),
      el('div', { class: 'ov-row ov-row-b' }, soon, tickets),
      el('div', { class: 'ov-row ov-row-c' }, scope, history)));
  }

  /* =====================================================================
     Tickets
     ===================================================================== */
  const newTicket = () => ticketForm({ contracts: [s.c], contractId: id, owner, onCreated: (t) => { s.tks.unshift(t); location.hash = href('tickets', t.number); } });
  let stopTicket = null;
  function ticketsSection() {
    const selected = opts.sub ? s.tks.find((t) => String(t.number) === String(opts.sub)) : null;
    const list = el('section', { class: 'cv-card tk-pane-list' },
      el('div', { class: 'cv-card-head' }, el('h2', { text: owner ? 'Tickets' : 'Your requests' }),
        s.c.status !== 'lost' ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: owner ? '+ New ticket' : '+ New request', onclick: newTicket }) : null),
      s.tks.length ? ticketRows(s.tks, { owner, onOpen: (t) => { location.hash = href('tickets', t.number); } })
        : el('p', { class: 'cv-empty', text: owner ? 'No tickets on this project yet.' : 'Need a change, found a bug, or have a question? Send a request (with screenshots or files) and Landon will reply here.' }));
    list.querySelectorAll('.tk-rows button').forEach((b, i) => { if (s.tks[i] === selected) b.classList.add('on'); });
    const pane = el('section', { class: 'tk-pane' });
    fill(body, el('div', { class: `tk-split${selected ? ' show-detail' : ''}` }, list, pane));
    stopTicket?.(); stopTicket = null;
    if (!selected) {
      fill(pane, el('div', { class: 'detail-empty' }, el('span', { class: 'tk-empty-ico', html: icon.tickets }),
        el('p', { text: s.tks.length ? 'Pick a ticket to see it and reply.' : owner ? 'Tickets the client sends show up here.' : 'Your requests will show up here.' })));
      return;
    }
    ticketView(pane, {
      id: selected.id, owner, me: opts.me, contracts: [s.c],
      onBack: () => { location.hash = href('tickets'); },
      onChanged: (t) => { const i = s.tks.findIndex((x) => x.id === t.id); if (i >= 0) s.tks[i] = t; renderTabs(); opts.onChanged?.(s.c); },
      onDeleted: () => { s.tks = s.tks.filter((t) => t.id !== selected.id); location.hash = href('tickets'); },
      onRead: opts.onRead,
    }).then((stop) => { stopTicket = stop; });
  }

  /* =====================================================================
     Schedule
     ===================================================================== */

  let cal = null;
  function scheduleSection() {
    cal = calendarView(body, { contractId: id, owner, getContracts: () => [s.c] });
  }

  /* =====================================================================
     Files: upload anything to the project (stylesheets, CSVs, PDFs,
     images, zips…), plus everything attached on its tickets
     ===================================================================== */
  const PF_BUCKET = 'project-files';
  const PF_MAX = 50 * 1024 * 1024;
  const extOf = (n = '') => (n.includes('.') ? n.split('.').pop().toLowerCase().slice(0, 5) : 'file');
  const EXT_TONE = { css: 'code', scss: 'code', js: 'code', ts: 'code', html: 'code', json: 'code', csv: 'data', xlsx: 'data', xls: 'data', tsv: 'data',
    pdf: 'doc', doc: 'doc', docx: 'doc', txt: 'doc', md: 'doc', png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
    zip: 'zip', rar: 'zip', '7z': 'zip', fig: 'img', psd: 'img', ai: 'img', mp4: 'vid', mov: 'vid' };
  let filesState = null;

  async function uploadProjectFiles(list, status) {
    let okCount = 0;
    for (const f of list) {
      if (f.size > PF_MAX) { toast(`${f.name} is over 50 MB`, 'error'); continue; }
      status(`Uploading ${f.name}…`);
      const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
      const path = `${id}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const up = await supabase.storage.from(PF_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (up.error) { toast(`Couldn’t upload ${f.name}: ${up.error.message}`, 'error'); continue; }
      const ins = await supabase.from('project_files').insert({ contract_id: id, path, name: f.name, size: f.size, type: f.type || null });
      if (ins.error) { await supabase.storage.from(PF_BUCKET).remove([path]); toast(`Couldn’t save ${f.name}: ${ins.error.message}`, 'error'); continue; }
      okCount++;
    }
    status('');
    if (okCount) toast(`${okCount} file${okCount === 1 ? '' : 's'} uploaded`);
    await loadFiles();
    renderFiles();
  }

  async function loadFiles() {
    const ids = s.tks.map((t) => t.id);
    const [pf, tm] = await Promise.all([
      supabase.from('project_files').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
      ids.length ? supabase.from('ticket_messages').select('ticket_id, files, created_at').in('ticket_id', ids).neq('files', '[]') : Promise.resolve({ data: [] }),
    ]);
    if (pf.error) toast(`Couldn’t load files: ${pf.error.message}`, 'error');
    const groups = [];
    for (const t of s.tks) {
      const files = [...(t.files || []), ...(tm.data || []).filter((m) => m.ticket_id === t.id && m.files?.length).flatMap((m) => m.files)];
      const seen = new Set();
      const unique = files.filter((f) => (seen.has(f.path) ? false : seen.add(f.path)));
      if (unique.length) groups.push({ t, files: unique });
    }
    filesState = { shared: pf.data || [], groups };
  }

  function fileRow(f) {
    const ext = extOf(f.name);
    const mine = f.uploaded_by === opts.me.id;
    const thumb = el('span', { class: `pf-ico t-${EXT_TONE[ext] || 'other'}`, text: ext });
    const dl = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Download', onclick: async () => {
      const { data, error } = await supabase.storage.from(PF_BUCKET).createSignedUrl(f.path, 60 * 10, { download: f.name });
      if (error) return toast(`Couldn’t open it: ${error.message}`, 'error');
      location.assign(data.signedUrl);
    } });
    if ((f.type || '').startsWith('image/')) {
      supabase.storage.from(PF_BUCKET).createSignedUrl(f.path, 60 * 60).then(({ data }) => {
        if (data?.signedUrl) thumb.replaceChildren(el('img', { src: data.signedUrl, alt: '', loading: 'lazy' }));
      });
    }
    return el('li', { class: 'pf-row' },
      thumb,
      el('span', { class: 'pf-main' },
        el('strong', { text: f.name, title: f.name }),
        el('small', { text: `${formatBytes(f.size)} · ${mine ? 'You' : f.uploader_role === 'owner' && !owner ? 'Landon' : f.uploader_name || 'Someone'} · ${timeAgo(f.created_at)}` })),
      el('span', { class: 'pf-actions' }, dl,
        owner || mine ? armedButton('Remove', 'Sure?', async () => {
          await supabase.storage.from(PF_BUCKET).remove([f.path]);
          const { error } = await supabase.from('project_files').delete().eq('id', f.id);
          if (error) return toast(`Couldn’t remove: ${error.message}`, 'error');
          toast('File removed');
          await loadFiles(); renderFiles();
        }, 'link-btn danger') : null));
  }

  function renderFiles() {
    if (section !== 'files' || !filesState) return;
    const { shared, groups } = filesState;
    const input = el('input', { type: 'file', multiple: true, hidden: true });
    const status = el('p', { class: 'pf-status', 'aria-live': 'polite' });
    const setStatus = (t) => { status.textContent = t; drop.classList.toggle('busy', Boolean(t)); };
    const drop = el('div', { class: 'pf-drop', role: 'button', tabindex: 0, 'aria-label': 'Upload files' },
      el('span', { class: 'pf-drop-ico', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>' }),
      el('strong', { text: 'Drop files here, or click to browse' }),
      el('small', { text: 'Any type: stylesheets, CSVs, PDFs, images, zips… up to 50 MB each' }),
      status, input);
    drop.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { const l = [...input.files]; input.value = ''; if (l.length) uploadProjectFiles(l, setStatus); });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const l = [...e.dataTransfer.files]; if (l.length) uploadProjectFiles(l, setStatus); });

    const ticketTotal = groups.reduce((n, g) => n + g.files.length, 0);
    fill(body,
      el('section', { class: 'cv-card pf-card' },
        el('div', { class: 'cv-card-head' }, el('h2', { text: 'Shared files' }), shared.length ? el('span', { class: 'cv-count mono', text: `${shared.length} file${shared.length === 1 ? '' : 's'} · ${formatBytes(shared.reduce((n, f) => n + Number(f.size || 0), 0))}` }) : null),
        drop,
        shared.length ? el('ul', { class: 'pf-list' }, shared.map(fileRow))
          : el('p', { class: 'cv-empty', text: owner ? 'Nothing shared yet. Files you or the client add here stay with this project.' : 'Nothing shared yet. Add brand files, content, spreadsheets, anything Landon needs.' })),
      groups.length ? el('section', { class: 'cv-card' },
        el('div', { class: 'cv-card-head' }, el('h2', { text: 'From tickets' }), el('span', { class: 'cv-count mono', text: `${ticketTotal} file${ticketTotal === 1 ? '' : 's'}` })),
        groups.map((g) => el('div', { class: 'cv-file-group' },
          el('a', { class: 'cv-file-group-h', href: href('tickets', g.t.number) }, el('span', { class: 'mono', text: `#${g.t.number}` }), el('span', { text: g.t.title })),
          fileList(g.files)))) : null);
  }

  async function filesSection() {
    fill(body, el('div', { class: 'cv-loading', text: 'Gathering files…' }));
    await loadFiles();
    renderFiles();
  }

  /* ---------- go ---------- */
  renderHead();
  renderSection();

  // opening the project reads its notifications (a ticket reads its own when opened)
  if (section !== 'tickets') supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('contract_id', id).is('ticket_id', null).neq('kind', 'message').is('read_at', null).then(() => opts.onRead?.());

  /* ---------- live updates ---------- */
  const channel = supabase.channel(`contract-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contracts', filter: `id=eq.${id}` }, ({ new: c2 }) => {
      s.c = c2; renderHead();
      if (section === 'overview' && !scopeEditing) overview();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `contract_id=eq.${id}` }, ({ new: a }) => {
      if (section !== 'overview' || s.acts.some((x) => x.id === a.id)) return;
      s.acts.unshift(a); if (!scopeEditing) overview();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `contract_id=eq.${id}` }, async () => {
      const { data } = await supabase.from('tickets').select('*').eq('contract_id', id).order('updated_at', { ascending: false });
      s.tks = data || []; renderTabs();
      if (section === 'overview' && !scopeEditing) overview();
      if (section === 'tickets') {
        // refresh the list only; the open ticket keeps itself up to date
        const rows = body.querySelector('.tk-pane-list .tk-rows, .tk-pane-list .cv-empty');
        if (rows) rows.replaceWith(s.tks.length ? ticketRows(s.tks, { owner, onOpen: (t) => { location.hash = href('tickets', t.number); } }) : el('p', { class: 'cv-empty', text: 'No tickets yet.' }));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_files', filter: `contract_id=eq.${id}` }, async () => {
      if (section === 'files') { await loadFiles(); renderFiles(); }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `contract_id=eq.${id}` }, async () => {
      const { data } = await supabase.from('events').select('*').eq('contract_id', id).order('starts_at');
      s.evs = data || []; renderTabs();
      if (section === 'overview' && !scopeEditing) overview();
      if (section === 'schedule') cal?.reload();
    })
    .subscribe();

  return () => { stopTicket?.(); chatBox.destroy(); supabase.removeChannel(channel); };
}

const dueClass = (c) => (c.due_date && !['complete', 'lost'].includes(c.status) && new Date(c.due_date + 'T23:59:59') < new Date() ? 'cv-late' : '');

/* =====================================================================
   New / edit contract form (owners)
   ===================================================================== */
export function contractForm(initial = {}, { onSaved, title } = {}) {
  const isNew = !initial.id;
  const f = el('form', { class: 'crm-form', novalidate: true });
  const inp = (name, attrs = {}) => { const i = el('input', { name, ...attrs }); if (initial[name] != null) i.value = initial[name]; return i; };
  const statusSel = el('select', { name: 'status' }, Object.entries(STATUS).map(([k, v]) => el('option', { value: k, text: v.label, selected: k === (initial.status || 'proposal') ? true : null })));
  const billSel = el('select', { name: 'billing' },
    el('option', { value: 'one_time', text: 'One-time project', selected: initial.billing !== 'monthly' ? true : null }),
    el('option', { value: 'monthly', text: 'Monthly plan', selected: initial.billing === 'monthly' ? true : null }));
  const scope = el('textarea', { name: 'scope', rows: 5, maxlength: 20000, placeholder: 'What’s included (you can fill this in later)' });
  if (initial.scope) scope.value = initial.scope;
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });

  add(f, 
    field('Project name', inp('title', { required: true, maxlength: 160, placeholder: 'e.g. Booking website' })),
    el('div', { class: 'crm-form-row' },
      field('Client name', inp('client_name', { maxlength: 120, autocomplete: 'off' })),
      field('Client email', inp('client_email', { type: 'email', maxlength: 200, autocomplete: 'off' }), 'Their portal account is matched by this email')),
    field('Business', inp('company', { maxlength: 160 })),
    el('div', { class: 'crm-form-row' },
      field('Stage', statusSel),
      field('Billing', billSel)),
    el('div', { class: 'crm-form-row' },
      field('Price (USD)', inp('value', { type: 'number', min: 0, step: 50, inputmode: 'decimal', placeholder: '0' })),
      field('Start', inp('start_date', { type: 'date' })),
      field('Due', inp('due_date', { type: 'date' }))),
    isNew ? field('Scope of work', scope) : null,
    msg,
    el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: isNew ? 'Create contract' : 'Save changes' })));

  const m = modal(title || (isNew ? 'New contract' : 'Edit contract'), f, { wide: true });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => f.elements[n]?.value.trim() || null;
    const row = {
      title: v('title'), client_name: v('client_name'), client_email: v('client_email'), company: v('company'),
      status: v('status'), billing: v('billing'), value: Number(v('value')) || 0,
      start_date: v('start_date'), due_date: v('due_date'),
    };
    if (isNew) { row.scope = v('scope'); if (initial.inquiry_id) row.inquiry_id = initial.inquiry_id; if (initial.request_id) row.request_id = initial.request_id; }
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    if (!row.title) return say('Give the project a name.');
    if (row.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.client_email)) return say('That client email doesn’t look right.');
    if (row.start_date && row.due_date && row.due_date < row.start_date) return say('The due date is before the start.');
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const q = isNew ? supabase.from('contracts').insert(row) : supabase.from('contracts').update(row).eq('id', initial.id);
    const { data, error } = await q.select().single();
    btn.disabled = false;
    if (error) return say(error.message);
    m.close();
    toast(isNew ? 'Contract created' : 'Saved');
    onSaved?.(data);
  });
  return m;
}

/* =====================================================================
   Invite a client to their portal (owners)
   ===================================================================== */
export async function inviteClient(email) {
  let { data: open } = await supabase.from('invites').select('*').ilike('email', email).is('accepted_at', null).maybeSingle();
  if (!open) {
    const { data: { user } } = await supabase.auth.getUser();
    const res = await supabase.from('invites').insert({ email, role: 'client', invited_by: user.id }).select().single();
    if (res.error) return toast(`Couldn’t create the invite: ${res.error.message}`, 'error');
    open = res.data;
  }
  const link = `${SITE}signup.html?invite=${open.token}`;
  const input = el('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Invite link', class: 'crm-link' });
  const mail = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your Williams Systems project page')}&body=${encodeURIComponent(`Hi,\n\nYour project page is ready. Create your account here to see the scope, progress, and chat with me:\n${link}\n\nLandon`)}`;
  modal('Invite to the client portal', el('div', { class: 'crm-form' },
    el('p', { text: `Send ${email} this link. Once they create their account, this contract shows up on their page.` }),
    input,
    el('div', { class: 'crm-form-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', text: 'Copy link', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch { input.select(); } } }),
      el('a', { class: 'btn btn-primary', href: mail, text: 'Email it' }))));
}

export { $, $$ };
