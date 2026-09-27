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
  const [msgs, evs, acts, tks, fds] = await Promise.all([
    { data: [] },
    supabase.from('events').select('*').eq('contract_id', id).order('starts_at'),
    section === 'overview' ? supabase.from('activity').select('*').eq('contract_id', id).order('created_at', { ascending: false }).limit(60) : { data: [] },
    supabase.from('tickets').select('*').eq('contract_id', id).order('updated_at', { ascending: false }),
    supabase.from('project_folders').select('*').eq('contract_id', id),
  ]);
  const s = { c: c.data, msgs: msgs.data || [], evs: evs.data || [], acts: acts.data || [], tks: tks.data || [], folders: fds.data || [] };
  const href = (sec, sub) => projectHref(s.c, sec, sub);
  opts.onFolders?.(s.c, s.folders, section === 'files' ? opts.sub || null : undefined);
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
     Files: a file system for the project. Folders (nested) hold every
     file; open them, go back up with the path bar, drag things into
     folders, rename, add notes, upload into the folder you're in.
     Ticket attachments show as a read-only folder.
     Address: #/<project>/files/<folder id>
     ===================================================================== */
  const PF_BUCKET = 'project-files';
  const PF_MAX = 50 * 1024 * 1024;
  const DEFAULT_FOLDERS = ['Brand assets', 'Content', 'Documents', 'Designs'];
  const TICKETS = 'tickets';                  // virtual folder: ticket attachments
  const extOf = (n = '') => (n.includes('.') ? n.split('.').pop().toLowerCase().slice(0, 5) : 'file');
  const EXT_TONE = { css: 'code', scss: 'code', js: 'code', ts: 'code', html: 'code', json: 'code', csv: 'data', xlsx: 'data', xls: 'data', tsv: 'data',
    pdf: 'doc', doc: 'doc', docx: 'doc', txt: 'doc', md: 'doc', png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
    zip: 'zip', rar: 'zip', '7z': 'zip', fig: 'img', psd: 'img', ai: 'img', mp4: 'vid', mov: 'vid' };
  const I = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICO = {
    folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 1.8),
    lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    download: I('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
    note: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    rename: I('<path d="M4 7V5h16v2M9 20h6M12 5v15"/>'),
    move: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    trash: I('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
    up: I('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    grid: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    upload: I('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>'),
    newFolder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>', 1.8),
    search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  };
  const PF_SORTS = [
    ['name', 'Name', (a, b) => a.name.localeCompare(b.name)],
    ['new', 'Newest', (a, b) => new Date(b.created_at) - new Date(a.created_at)],
    ['size', 'Largest', (a, b) => Number(b.size) - Number(a.size)],
    ['type', 'Type', (a, b) => extOf(a.name).localeCompare(extOf(b.name)) || a.name.localeCompare(b.name)],
  ];
  const fx = (() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('ws-files-view') || '{}'); } catch { /* private mode */ }
    return { cur: null, q: '', sort: saved.sort && PF_SORTS.some((x) => x[0] === saved.sort) ? saved.sort : 'name', view: saved.view || 'list', editing: null };
  })();
  const rememberView = () => { try { localStorage.setItem('ws-files-view', JSON.stringify({ sort: fx.sort, view: fx.view })); } catch { /* ignore */ } };
  const signed = new Map();
  let files = [];            // project files
  let ticketFiles = [];      // attachments from tickets, grouped by ticket in the virtual folder
  let fxEls = null;

  /* ---------- the tree ---------- */
  const folderById = (fid) => s.folders.find((f) => f.id === fid);
  const kids = (pid) => s.folders.filter((f) => (f.parent_id || null) === (pid || null)).sort((a, b) => a.name.localeCompare(b.name));
  const filesIn = (fid) => files.filter((f) => f.folder_id === fid);
  const pathTo = (fid) => { const out = []; let f = folderById(fid); while (f) { out.unshift(f); f = folderById(f.parent_id); } return out; };
  const descendants = (fid) => { const out = []; const walk = (id) => kids(id).forEach((k) => { out.push(k.id); walk(k.id); }); walk(fid); return out; };
  const itemCount = (fid) => kids(fid).length + filesIn(fid).length;
  const isReal = (fid) => Boolean(fid && folderById(fid));
  const isTicketFolder = (fid) => fid === TICKETS || String(fid || '').startsWith('ticket-');

  async function loadFolders() {
    const { data, error } = await supabase.from('project_folders').select('*').eq('contract_id', id);
    if (!error) s.folders = data || [];
    opts.onFolders?.(s.c, s.folders, fx.cur);
  }
  async function loadFiles() {
    const ids = s.tks.map((t) => t.id);
    const [pf, tm] = await Promise.all([
      supabase.from('project_files').select('*').eq('contract_id', id),
      ids.length ? supabase.from('ticket_messages').select('ticket_id, files').in('ticket_id', ids).neq('files', '[]') : Promise.resolve({ data: [] }),
    ]);
    if (pf.error) toast(`Couldn’t load files: ${pf.error.message}`, 'error');
    files = pf.data || [];
    ticketFiles = [];
    for (const t of s.tks) {
      const seen = new Set();
      for (const f of [...(t.files || []), ...(tm.data || []).filter((m) => m.ticket_id === t.id).flatMap((m) => m.files || [])]) {
        if (seen.has(f.path)) continue;
        seen.add(f.path);
        ticketFiles.push({ ...f, ticket: t, created_at: t.created_at });
      }
    }
  }
  // every project starts with a few folders so nothing is ever loose
  async function ensureDefaults() {
    if (s.folders.length) return;
    await supabase.from('project_folders').insert(DEFAULT_FOLDERS.map((name) => ({ contract_id: id, name })));
    await loadFolders();
  }

  /* ---------- actions ---------- */
  function go(fid) {
    fx.cur = fid || null;
    fx.editing = null;
    history.replaceState(null, '', href('files', fx.cur || undefined));
    opts.onFolders?.(s.c, s.folders, fx.cur);
    renderExplorer();
  }

  async function uploadInto(list, fid, status) {
    if (!isReal(fid)) { toast('Open a folder first, then upload into it', 'error'); return; }
    let okCount = 0;
    for (const f of list) {
      if (f.size > PF_MAX) { toast(`${f.name} is over 50 MB`, 'error'); continue; }
      status(`Uploading ${f.name}…`);
      const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
      const path = `${id}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const up = await supabase.storage.from(PF_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
      if (up.error) { toast(`Couldn’t upload ${f.name}: ${up.error.message}`, 'error'); continue; }
      const ins = await supabase.from('project_files').insert({ contract_id: id, path, name: f.name, size: f.size, type: f.type || null, folder_id: fid });
      if (ins.error) { await supabase.storage.from(PF_BUCKET).remove([path]); toast(`Couldn’t save ${f.name}: ${ins.error.message}`, 'error'); continue; }
      okCount++;
    }
    status('');
    if (okCount) toast(`${okCount} file${okCount === 1 ? '' : 's'} uploaded to ${folderById(fid).name}`);
    await loadFiles(); renderExplorer();
  }

  async function moveItem(kind, itemId, toFolder) {
    if (!isReal(toFolder)) return toast('Pick a folder to move it into', 'error');
    if (kind === 'file') {
      const f = files.find((x) => x.id === itemId);
      if (!f || f.folder_id === toFolder) return;
      const { error } = await supabase.from('project_files').update({ folder_id: toFolder }).eq('id', itemId);
      if (error) return toast(`Couldn’t move: ${error.message}`, 'error');
      f.folder_id = toFolder;
    } else {
      const d = folderById(itemId);
      if (!d || d.id === toFolder || d.parent_id === toFolder || descendants(itemId).includes(toFolder)) return;
      const { error } = await supabase.from('project_folders').update({ parent_id: toFolder }).eq('id', itemId);
      if (error) return toast(/unique/i.test(error.message) ? 'There’s already a folder with that name there' : `Couldn’t move: ${error.message}`, 'error');
      d.parent_id = toFolder;
      opts.onFolders?.(s.c, s.folders, fx.cur);
    }
    toast(`Moved to ${folderById(toFolder).name}`);
    renderExplorer();
  }

  function nameModal(title, value, button, then) {
    const input = el('input', { maxlength: 120, value: value || '' });
    const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
    const f = el('form', { class: 'crm-form' }, field('Name', input), msg,
      el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: button })));
    const m = modal(title, f);
    setTimeout(() => { input.focus(); input.select(); }, 0);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      const err = await then(v);
      if (err) { msg.textContent = err; msg.hidden = false; } else m.close();
    });
  }
  const newFolder = () => nameModal(fx.cur && isReal(fx.cur) ? `New folder in ${folderById(fx.cur).name}` : 'New folder', '', 'Create folder', async (name) => {
    const { error } = await supabase.from('project_folders').insert({ contract_id: id, parent_id: isReal(fx.cur) ? fx.cur : null, name: name.slice(0, 80) });
    if (error) return /unique|duplicate/i.test(error.message) ? 'There’s already a folder with that name here.' : error.message;
    await loadFolders(); renderExplorer(); toast('Folder created');
  });
  const renameFolder = (d) => nameModal('Rename folder', d.name, 'Rename', async (name) => {
    const { error } = await supabase.from('project_folders').update({ name: name.slice(0, 80) }).eq('id', d.id);
    if (error) return /unique|duplicate/i.test(error.message) ? 'There’s already a folder with that name here.' : error.message;
    d.name = name.slice(0, 80); opts.onFolders?.(s.c, s.folders, fx.cur); renderExplorer();
  });
  const renameFile = (f) => nameModal('Rename file', f.name, 'Rename', async (name) => {
    const keepExt = f.name.includes('.') && !name.includes('.') ? `${name}.${extOf(f.name)}` : name;
    const { error } = await supabase.from('project_files').update({ name: keepExt.slice(0, 255) }).eq('id', f.id);
    if (error) return error.message;
    f.name = keepExt.slice(0, 255); renderExplorer();
  });
  function moveModal(kind, item) {
    const blocked = kind === 'folder' ? new Set([item.id, ...descendants(item.id)]) : new Set();
    const here = kind === 'folder' ? item.parent_id : item.folder_id;
    const rows = [];
    const walk = (pid, depth) => kids(pid).forEach((d) => {
      if (blocked.has(d.id)) return;
      rows.push(el('li', {}, el('button', { type: 'button', class: `fx-pick${d.id === here ? ' here' : ''}`, style: { paddingLeft: `${12 + depth * 18}px` }, disabled: d.id === here ? true : null,
        onclick: async () => { m.close(); await moveItem(kind, item.id, d.id); } },
        el('span', { class: 'fx-pick-ico', html: ICO.folder }), d.name, d.id === here ? el('small', { text: 'current' }) : null)));
      walk(d.id, depth + 1);
    });
    walk(null, 0);
    const m = modal(`Move “${item.name}” to…`, el('div', { class: 'crm-form' }, el('ul', { class: 'fx-picker' }, rows)));
  }
  async function deleteFolder(d) {
    const sub = descendants(d.id);
    const all = [d.id, ...sub];
    const inside = files.filter((f) => all.includes(f.folder_id));
    if ((sub.length || inside.length) && !owner) return toast('Empty the folder first', 'error');
    if (inside.length) await supabase.storage.from(PF_BUCKET).remove(inside.map((f) => f.path));
    if (inside.length) await supabase.from('project_files').delete().in('id', inside.map((f) => f.id));
    // deepest folders first
    const depth = (fid) => pathTo(fid).length;
    for (const fid of [...all].sort((a, b) => depth(b) - depth(a))) {
      const { error } = await supabase.from('project_folders').delete().eq('id', fid);
      if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
    }
    toast(`Deleted ${d.name}${inside.length ? ` and ${inside.length} file${inside.length === 1 ? '' : 's'}` : ''}`);
    await Promise.all([loadFolders(), loadFiles()]);
    if (all.includes(fx.cur)) go(d.parent_id); else renderExplorer();
  }
  async function deleteFile(f) {
    await supabase.storage.from(PF_BUCKET).remove([f.path]);
    const { error } = await supabase.from('project_files').delete().eq('id', f.id);
    if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
    toast('File deleted');
    await loadFiles(); renderExplorer();
  }
  const download = async (f, bucket = PF_BUCKET) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(f.path, 60 * 10, { download: f.name });
    if (error) return toast(`Couldn’t open it: ${error.message}`, 'error');
    location.assign(data.signedUrl);
  };

  /* ---------- pieces ---------- */
  const iconBtn = (svg, label, onclick, extra = '') => el('button', { type: 'button', class: `pf-ib ${extra}`, 'aria-label': label, title: label, html: svg, onclick: (e) => { e.stopPropagation(); onclick(); } });
  function confirmBtn(label, run) {
    let timer;
    const btn = el('button', { type: 'button', class: 'pf-ib pf-del', 'aria-label': label, title: label, html: ICO.trash });
    const reset = () => { delete btn.dataset.armed; btn.innerHTML = ICO.trash; };
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!btn.dataset.armed) { btn.dataset.armed = 'true'; btn.textContent = 'Delete?'; timer = setTimeout(reset, 4000); return; }
      clearTimeout(timer); btn.disabled = true; await run(); btn.disabled = false;
    });
    return btn;
  }
  function thumbFor(f, bucket = PF_BUCKET) {
    const ext = extOf(f.name);
    const box = el('span', { class: `pf-ico t-${EXT_TONE[ext] || 'other'}`, text: ext });
    if ((f.type || '').startsWith('image/')) {
      const put = (url) => box.replaceChildren(el('img', { src: url, alt: '', loading: 'lazy' }));
      if (signed.has(f.path)) put(signed.get(f.path));
      else supabase.storage.from(bucket).createSignedUrl(f.path, 60 * 60).then(({ data }) => { if (data?.signedUrl) { signed.set(f.path, data.signedUrl); put(data.signedUrl); } });
    }
    return box;
  }
  // anything you can drop a file or folder onto
  function dropTarget(node, fid) {
    node.addEventListener('dragover', (e) => {
      const t = e.dataTransfer.types;
      if ((t.includes('text/x-ws-file') || t.includes('text/x-ws-folder')) && isReal(fid)) { e.preventDefault(); node.classList.add('drop'); }
    });
    node.addEventListener('dragleave', () => node.classList.remove('drop'));
    node.addEventListener('drop', (e) => {
      const fileId = e.dataTransfer.getData('text/x-ws-file');
      const folderId = e.dataTransfer.getData('text/x-ws-folder');
      if (!fileId && !folderId) return;
      e.preventDefault(); e.stopPropagation(); node.classList.remove('drop');
      if (fileId) moveItem('file', fileId, fid); else moveItem('folder', folderId, fid);
    });
  }
  const draggable = (node, type, itemId) => {
    node.draggable = true;
    node.addEventListener('dragstart', (e) => { e.dataTransfer.setData(type, itemId); e.dataTransfer.effectAllowed = 'move'; node.classList.add('dragging'); });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));
  };

  function folderRow(d, { virtual = false, count, name, onOpen } = {}) {
    const open = onOpen || (() => go(d.id));
    const row = el('li', { class: `fx-row fx-folder${virtual ? ' virtual' : ''}`, tabindex: 0, 'aria-label': `Folder ${name || d.name}` },
      el('span', { class: 'fx-name' },
        el('span', { class: 'fx-folder-ico', html: virtual ? ICO.lock : ICO.folder }),
        el('button', { type: 'button', class: 'fx-open', text: name || d.name, title: name || d.name, onclick: (e) => { e.stopPropagation(); open(); } })),
      el('span', { class: 'fx-note' }),
      el('span', { class: 'fx-date', text: virtual ? 'Read only' : fmtDate(d.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) }),
      el('span', { class: 'fx-size', text: `${count ?? itemCount(d.id)} item${(count ?? itemCount(d.id)) === 1 ? '' : 's'}` }),
      el('span', { class: 'pf-actions' }, virtual ? null : [
        iconBtn(ICO.rename, 'Rename', () => renameFolder(d)),
        iconBtn(ICO.move, 'Move', () => moveModal('folder', d)),
        owner || d.created_by === opts.me.id ? confirmBtn(`Delete ${d.name}`, () => deleteFolder(d)) : null]));
    row.addEventListener('dblclick', open);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) open(); });
    if (!virtual) { dropTarget(row, d.id); draggable(row, 'text/x-ws-folder', d.id); }
    return row;
  }

  function fileRow(f, { readonly = false, bucket = PF_BUCKET, showPath = false } = {}) {
    const mine = f.uploaded_by === opts.me.id;
    const who = readonly ? `#${f.ticket.number}` : mine ? 'You' : f.uploader_role === 'owner' && !owner ? 'Landon' : f.uploader_name || 'Someone';
    let editor = null;
    if (fx.editing === f.id) {
      const area = el('textarea', { rows: 2, maxlength: 500, placeholder: 'e.g. Final version · Use on dark backgrounds', 'aria-label': `Note for ${f.name}` });
      area.value = f.note || '';
      const done = () => { fx.editing = null; renderExplorer(); };
      const saveNote = async () => {
        fx.editing = null;
        const { error } = await supabase.from('project_files').update({ note: area.value.trim() || null }).eq('id', f.id);
        if (error) toast(`Couldn’t save: ${error.message}`, 'error'); else { f.note = area.value.trim() || null; toast('Note saved'); }
        renderExplorer();
      };
      area.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); } if (e.key === 'Escape') done(); });
      editor = el('div', { class: 'pf-editor fx-editor' }, area, el('div', { class: 'cv-row-end' },
        el('button', { type: 'button', class: 'link-btn', text: 'Cancel', onclick: done }),
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Save note', onclick: saveNote })));
      setTimeout(() => area.focus(), 0);
    }
    const where = showPath ? (readonly ? `Ticket attachments / #${f.ticket.number}` : pathTo(f.folder_id).map((p) => p.name).join(' / ')) : null;
    const row = el('li', { class: `fx-row fx-file${readonly ? ' readonly' : ''}${fx.editing === f.id ? ' editing' : ''}` },
      el('span', { class: 'fx-name' }, thumbFor(f, bucket),
        el('span', { class: 'fx-fname' }, el('strong', { text: f.name, title: f.name }), where ? el('small', { text: where }) : el('small', { class: 'fx-who', text: who }))),
      el('span', { class: 'fx-note', title: f.note || '' }, f.note && fx.editing !== f.id ? f.note : ''),
      el('span', { class: 'fx-date', text: fmtDate(f.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) }),
      el('span', { class: 'fx-size', text: formatBytes(f.size) }),
      el('span', { class: 'pf-actions' },
        iconBtn(ICO.download, `Download ${f.name}`, () => download(f, bucket)),
        readonly ? null : [
          iconBtn(ICO.note, f.note ? 'Edit note' : 'Add a note', () => { fx.editing = f.id; renderExplorer(); }),
          iconBtn(ICO.rename, 'Rename', () => renameFile(f)),
          iconBtn(ICO.move, 'Move', () => moveModal('file', f)),
          owner || mine ? confirmBtn(`Delete ${f.name}`, () => deleteFile(f)) : null]),
      editor);
    row.addEventListener('dblclick', () => download(f, bucket));
    if (!readonly) draggable(row, 'text/x-ws-file', f.id);
    return row;
  }

  /* ---------- the explorer ---------- */
  function renderFiles() {
    if (section !== 'files') return;
    const input = el('input', { type: 'file', multiple: true, hidden: true });
    const status = el('span', { class: 'pf-status', 'aria-live': 'polite' });
    const setStatus = (t) => { status.textContent = t; card.classList.toggle('busy', Boolean(t)); };
    input.addEventListener('change', () => { const l = [...input.files]; input.value = ''; if (l.length) uploadInto(l, fx.cur, setStatus); });
    const search = el('input', { type: 'search', placeholder: 'Search all files…', 'aria-label': 'Search all files', value: fx.q });
    search.addEventListener('input', () => { fx.q = search.value.trim().toLowerCase(); renderExplorer(); });
    const sort = el('select', { class: 'ct-sort pf-sort', 'aria-label': 'Sort' }, PF_SORTS.map(([k, label]) => el('option', { value: k, text: label, selected: fx.sort === k ? true : null })));
    sort.addEventListener('change', () => { fx.sort = sort.value; rememberView(); renderExplorer(); });
    const views = el('div', { class: 'pf-views', role: 'group', 'aria-label': 'View' }, ['list', 'grid'].map((v) => el('button', { type: 'button', class: 'pf-view', 'data-v': v, 'aria-pressed': String(fx.view === v), 'aria-label': `${v} view`, title: v === 'list' ? 'List' : 'Grid', html: ICO[v],
      onclick: () => { fx.view = v; rememberView(); views.querySelectorAll('.pf-view').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); renderExplorer(); } })));
    const upBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm pf-upload', html: `${ICO.upload}<span>Upload</span>`, onclick: () => input.click() });
    fxEls = {
      crumbs: el('nav', { class: 'fx-crumbs', 'aria-label': 'Folder path' }),
      pane: el('div', { class: 'fx-pane' }),
      upBtn,
      newBtn: el('button', { type: 'button', class: 'btn btn-ghost btn-sm fx-newfolder', html: `${ICO.newFolder}<span>New folder</span>`, onclick: newFolder }),
    };
    const card = el('section', { class: 'cv-card fx' },
      el('div', { class: 'fx-top' }, fxEls.crumbs, el('div', { class: 'fx-top-actions' }, fxEls.newBtn, upBtn, input)),
      el('div', { class: 'pf-toolbar' },
        el('label', { class: 'ct-search pf-search' }, el('span', { class: 'ct-search-ico', 'aria-hidden': 'true', html: ICO.search }), search),
        sort, views),
      status, fxEls.pane,
      el('div', { class: 'pf-dropveil', 'aria-hidden': 'true' }, el('span', { html: ICO.upload }), el('strong', { class: 'fx-veil-text' })));
    // drop files from your computer onto the explorer: they upload into the open folder
    let depth = 0;
    card.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) { depth++; card.querySelector('.fx-veil-text').textContent = isReal(fx.cur) ? `Drop to upload to ${folderById(fx.cur).name}` : 'Open a folder to upload into it'; card.classList.add('over'); } });
    card.addEventListener('dragleave', (e) => { if (e.dataTransfer.types.includes('Files') && --depth <= 0) { depth = 0; card.classList.remove('over'); } });
    card.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
    card.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); depth = 0; card.classList.remove('over');
      const l = [...e.dataTransfer.files]; if (l.length) uploadInto(l, fx.cur, setStatus);
    });
    fill(body, card);
    renderExplorer();
  }

  function renderExplorer() {
    if (!fxEls || section !== 'files') return;
    if (fx.cur && !isReal(fx.cur) && !isTicketFolder(fx.cur)) fx.cur = null;
    const real = isReal(fx.cur);

    // path bar: Files › A › B (each part is a drop target)
    const crumb = (label, fid, last) => {
      const c = el(last ? 'span' : 'button', { type: last ? null : 'button', class: `fx-crumb${last ? ' here' : ''}`, text: label, onclick: last ? null : () => go(fid) });
      if (!last && (fid === null || isReal(fid))) dropTarget(c, fid);
      return c;
    };
    const parts = [['Files', null]];
    if (isTicketFolder(fx.cur)) {
      parts.push(['Ticket attachments', TICKETS]);
      if (fx.cur !== TICKETS) { const t = s.tks.find((x) => `ticket-${x.number}` === fx.cur); parts.push([t ? `#${t.number} ${t.title}` : 'Ticket', fx.cur]); }
    } else pathTo(fx.cur).forEach((p) => parts.push([p.name, p.id]));
    fill(fxEls.crumbs, parts.map(([label, fid], i) => [i ? el('span', { class: 'fx-sep', text: '›' }) : null, crumb(label, fid, i === parts.length - 1)]));
    fxEls.upBtn.disabled = !real;
    fxEls.upBtn.title = real ? `Upload to ${folderById(fx.cur).name}` : 'Open a folder to upload into it';
    fxEls.newBtn.hidden = isTicketFolder(fx.cur);

    const sorter = (PF_SORTS.find((x) => x[0] === fx.sort) || PF_SORTS[0])[2];
    const head = el('li', { class: 'fx-row fx-head', 'aria-hidden': 'true' },
      el('span', { text: 'Name' }), el('span', { text: 'Note' }), el('span', { text: 'Added' }), el('span', { text: 'Size' }), el('span'));
    const listOf = (items) => el('ul', { class: `fx-list ${fx.view}` }, fx.view === 'list' ? head : null, items);

    // searching looks through everything
    if (fx.q) {
      const hits = [
        ...files.filter((f) => [f.name, f.note].some((x) => x && x.toLowerCase().includes(fx.q))).sort(sorter).map((f) => fileRow(f, { showPath: true })),
        ...ticketFiles.filter((f) => f.name.toLowerCase().includes(fx.q)).map((f) => fileRow(f, { readonly: true, bucket: 'ticket-files', showPath: true })),
      ];
      const folderHits = s.folders.filter((d) => d.name.toLowerCase().includes(fx.q)).map((d) => folderRow(d));
      fill(fxEls.pane, folderHits.length || hits.length ? listOf([...folderHits, ...hits]) : empty('Nothing matches', 'Try another name, or a word from a note.'));
      return;
    }

    const rows = [];
    if (fx.cur) {
      const parent = isTicketFolder(fx.cur) ? (fx.cur === TICKETS ? null : TICKETS) : folderById(fx.cur)?.parent_id || null;
      const up = el('li', { class: 'fx-row fx-up', tabindex: 0 },
        el('span', { class: 'fx-name' }, el('span', { class: 'fx-folder-ico', html: ICO.up }), el('button', { type: 'button', class: 'fx-open', text: 'Back', onclick: () => go(parent) })),
        el('span'), el('span'), el('span'), el('span'));
      up.addEventListener('dblclick', () => go(parent));
      if (parent === null || isReal(parent)) dropTarget(up, parent);
      rows.push(up);
    }
    if (fx.cur === TICKETS) {
      const byTicket = new Map();
      ticketFiles.forEach((f) => byTicket.set(f.ticket.number, [...(byTicket.get(f.ticket.number) || []), f]));
      [...byTicket.entries()].forEach(([n, list]) => {
        const t = list[0].ticket;
        rows.push(folderRow({ id: `ticket-${n}`, created_at: t.created_at }, { virtual: true, count: list.length, name: `#${n} ${t.title}`, onOpen: () => go(`ticket-${n}`) }));
      });
    } else if (String(fx.cur || '').startsWith('ticket-')) {
      ticketFiles.filter((f) => `ticket-${f.ticket.number}` === fx.cur).sort(sorter).forEach((f) => rows.push(fileRow(f, { readonly: true, bucket: 'ticket-files' })));
    } else {
      kids(fx.cur).forEach((d) => rows.push(folderRow(d)));
      if (!fx.cur && ticketFiles.length) rows.push(folderRow({ id: TICKETS, created_at: s.c.created_at }, { virtual: true, count: new Set(ticketFiles.map((f) => f.ticket.number)).size, name: 'Ticket attachments', onOpen: () => go(TICKETS) }));
      if (real) filesIn(fx.cur).sort(sorter).forEach((f) => rows.push(fileRow(f)));
    }
    const hasContent = rows.some((r) => !r.classList.contains('fx-up'));
    fill(fxEls.pane, hasContent ? listOf(rows)
      : [listOf(rows), real ? empty('This folder is empty', 'Upload files, drop them here, or drag files in from another folder.', true) : empty('No folders yet', 'Create a folder to start organizing.')]);
  }

  function empty(title, text, withUpload = false) {
    return el('div', { class: 'pf-empty fx-empty' },
      el('span', { class: 'pf-empty-ico', html: withUpload ? ICO.upload : ICO.folder }),
      el('strong', { text: title }), el('p', { text }),
      withUpload ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Upload files', onclick: () => fxEls.upBtn.click() }) : null);
  }

  async function filesSection() {
    fill(body, el('div', { class: 'cv-loading', text: 'Opening files…' }));
    fx.cur = opts.sub || null;
    await Promise.all([loadFolders(), loadFiles()]);
    await ensureDefaults();
    opts.onFolders?.(s.c, s.folders, fx.cur);
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
      if (section === 'files' && !fx.editing) { await loadFiles(); renderExplorer(); }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_folders', filter: `contract_id=eq.${id}` }, async () => {
      const { data } = await supabase.from('project_folders').select('*').eq('contract_id', id);
      s.folders = data || [];
      opts.onFolders?.(s.c, s.folders, section === 'files' ? fx.cur : undefined);
      if (section === 'files' && !fx.editing) renderExplorer();
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
