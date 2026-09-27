/* =====================================================================
   Calendar — everything in one place, month by month:
     · events you schedule (meetings, calls, deadlines, payments…)
     · contract start and due dates
     · everything logged: contract activity, new inquiries, account requests
   Pick a day to see its full log and add to it.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, REDUCED, EVENT_KINDS, ymd, fmtTime, fmtDate, toast, modal, field, armedButton, icon, meetingName, add } from './util.js';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function calendarView(root, { getContracts, onOpenContract, onOpenRequests }) {
  const today = ymd(new Date());
  const st = { month: startOfMonth(new Date()), selected: today, items: [], events: [] };

  const title = el('h2', { class: 'cal-title' });
  const grid = el('div', { class: 'cal-grid', role: 'grid' });
  const panel = el('aside', { class: 'cal-panel', 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'cal' },
    el('div', { class: 'cal-bar' },
      el('div', { class: 'cal-nav' },
        el('button', { type: 'button', class: 'cal-btn', 'aria-label': 'Previous month', text: '‹', onclick: () => go(-1) }),
        title,
        el('button', { type: 'button', class: 'cal-btn', 'aria-label': 'Next month', text: '›', onclick: () => go(1) })),
      el('div', { class: 'cal-tools' },
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Today', onclick: () => { st.month = startOfMonth(new Date()); st.selected = today; load(); } }),
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', html: `${icon.plus}<span>New event</span>`, onclick: () => add(st.selected) }))),
    el('div', { class: 'cal-legend' }, [['event', 'Scheduled'], ['due', 'Due / start'], ['log', 'Logged'], ['request', 'Requests']].map(([k, t]) => el('span', { class: `lg-${k}` }, el('i'), t))),
    el('div', { class: 'cal-body' }, el('div', { class: 'cal-month' }, el('div', { class: 'cal-week' }, WEEK.map((d) => el('span', { text: d }))), grid), panel)));

  function go(n) { st.month = new Date(st.month.getFullYear(), st.month.getMonth() + n, 1); load(); }
  const add = (date, extra = {}) => eventModal({ date, ...extra }, { contracts: getContracts(), onSaved: load });

  async function load() {
    const first = new Date(st.month); first.setDate(1 - first.getDay());
    const last = new Date(first); last.setDate(first.getDate() + 42);
    const [from, to] = [first.toISOString(), last.toISOString()];
    title.textContent = st.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const [ev, act, inq, req] = await Promise.all([
      supabase.from('events').select('*').gte('starts_at', from).lt('starts_at', to).order('starts_at'),
      supabase.from('activity').select('*').gte('created_at', from).lt('created_at', to).order('created_at'),
      supabase.from('inquiries').select('id, name, company, created_at').gte('created_at', from).lt('created_at', to),
      supabase.from('access_requests').select('id, name, company, created_at').gte('created_at', from).lt('created_at', to),
    ]);
    const err = ev.error || act.error || inq.error || req.error;
    if (err) toast(`Couldn’t load the calendar: ${err.message}`, 'error');

    const contracts = getContracts();
    const nameOf = (cid) => contracts.find((c) => c.id === cid)?.title;
    const items = [];
    for (const e of ev.data || []) items.push({ date: ymd(e.starts_at), cls: `event k-${e.kind}`, title: e.title, time: e.all_day ? '' : fmtTime(e.starts_at), sort: e.starts_at, sub: [EVENT_KINDS[e.kind], nameOf(e.contract_id)].filter(Boolean).join(' · '), event: e });
    for (const c of contracts) {
      if (['lost'].includes(c.status)) continue;
      if (c.due_date) items.push({ date: c.due_date, cls: 'due', title: `Due: ${c.title}`, sort: c.due_date + 'T00', sub: c.company || c.client_name || '', contract: c });
      if (c.start_date) items.push({ date: c.start_date, cls: 'due start', title: `Start: ${c.title}`, sort: c.start_date + 'T00', sub: c.company || c.client_name || '', contract: c });
    }
    for (const a of act.data || []) items.push({ date: ymd(a.created_at), cls: 'log', title: a.summary, time: fmtTime(a.created_at), sort: a.created_at, sub: nameOf(a.contract_id) || '', logged: true, contract: contracts.find((c) => c.id === a.contract_id) });
    for (const q of inq.data || []) items.push({ date: ymd(q.created_at), cls: 'request', title: `Inquiry: ${q.name}`, time: fmtTime(q.created_at), sort: q.created_at, sub: q.company || '', logged: true, requests: 'inquiries' });
    for (const r of req.data || []) items.push({ date: ymd(r.created_at), cls: 'request', title: `Account request: ${r.name}`, time: fmtTime(r.created_at), sort: r.created_at, sub: r.company || '', logged: true, requests: 'accounts' });
    items.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
    st.items = items;
    renderGrid();
    renderPanel();
  }

  function renderGrid() {
    const first = new Date(st.month); first.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first); d.setDate(first.getDate() + i);
      const key = ymd(d);
      const list = st.items.filter((x) => x.date === key);
      const shown = list.filter((x) => !x.logged);
      const logged = list.length - shown.length;
      cells.push(el('button', {
        type: 'button', role: 'gridcell', 'data-day': key,
        class: `cal-day${d.getMonth() !== st.month.getMonth() ? ' out' : ''}${key === today ? ' today' : ''}${key === st.selected ? ' sel' : ''}`,
        'aria-label': `${d.toDateString()}, ${list.length} item${list.length === 1 ? '' : 's'}`,
        onclick: () => { st.selected = key; renderGrid(); renderPanel(); },
        ondblclick: () => add(key),
      },
        el('span', { class: 'cal-num', text: d.getDate() }),
        el('span', { class: 'cal-chips' },
          shown.slice(0, 3).map((x) => el('span', { class: `cal-chip ${x.cls}`, text: x.title })),
          shown.length > 3 ? el('span', { class: 'cal-more', text: `+${shown.length - 3} more` }) : null),
        el('span', { class: 'cal-dots' }, list.slice(0, 5).map((x) => el('i', { class: x.cls }))),
        logged ? el('span', { class: 'cal-logged mono', title: `${logged} logged`, text: logged }) : null));
    }
    grid.replaceChildren(...cells);
  }

  function renderPanel() {
    const list = st.items.filter((x) => x.date === st.selected);
    const planned = list.filter((x) => !x.logged);
    const logged = list.filter((x) => x.logged);
    const row = (x) => el('li', { class: `cal-item ${x.cls}` },
      el('button', { type: 'button', onclick: () => open(x) },
        el('i'),
        el('span', { class: 'cal-item-body' }, el('strong', { text: x.title }), x.sub ? el('small', { text: x.sub }) : null),
        x.time ? el('time', { class: 'mono', text: x.time }) : null),
      x.event?.link ? el('a', { class: 'btn btn-primary btn-sm cal-join', href: x.event.link, target: '_blank', rel: 'noopener noreferrer', text: 'Join' }) : null);
    panel.replaceChildren(
      el('div', { class: 'cal-panel-head' },
        el('h3', { text: fmtDate(st.selected, { weekday: 'long', month: 'long', day: 'numeric' }) }),
        el('button', { type: 'button', class: 'link-btn', text: '+ Add', onclick: () => add(st.selected) })),
      el('h4', { class: 'mono', text: 'Scheduled' }),
      planned.length ? el('ul', { class: 'cal-items' }, planned.map(row)) : el('p', { class: 'cal-none', text: 'Nothing scheduled.' }),
      el('h4', { class: 'mono', text: 'Logged' }),
      logged.length ? el('ul', { class: 'cal-items' }, logged.map(row)) : el('p', { class: 'cal-none', text: 'Nothing logged this day.' }));
  }

  function open(x) {
    if (x.event) return eventModal(x.event, { contracts: getContracts(), onSaved: load });
    if (x.contract) return onOpenContract(x.contract.id);
    if (x.requests) return onOpenRequests(x.requests);
  }

  load();
  return { reload: load, add };
}

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/* =====================================================================
   Add / edit an event
   ===================================================================== */
export function eventModal(initial = {}, { contracts = [], onSaved } = {}) {
  const isNew = !initial.id;
  const start = initial.starts_at ? new Date(initial.starts_at) : null;
  const end = initial.ends_at ? new Date(initial.ends_at) : null;
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const f = el('form', { class: 'crm-form', novalidate: true });
  const titleIn = el('input', { name: 'title', maxlength: 160, required: true, placeholder: 'e.g. Kickoff call', value: initial.title || '' });
  const kind = el('select', { name: 'kind' }, Object.entries(EVENT_KINDS).map(([k, v]) => el('option', { value: k, text: v, selected: k === (initial.kind || 'meeting') ? true : null })));
  const date = el('input', { type: 'date', name: 'date', required: true, value: start ? ymd(start) : initial.date || ymd(new Date()) });
  const allDay = el('input', { type: 'checkbox', name: 'all_day', checked: initial.all_day ? true : null });
  const t1 = el('input', { type: 'time', name: 'start', value: start ? hm(start) : '10:00' });
  const t2 = el('input', { type: 'time', name: 'end', value: end ? hm(end) : '' });
  const times = el('div', { class: 'crm-form-row' }, field('Starts', t1), field('Ends (optional)', t2));
  const sync = () => { times.hidden = allDay.checked; };
  allDay.addEventListener('change', sync); sync();
  const contract = el('select', { name: 'contract_id' },
    el('option', { value: '', text: '— Not tied to a contract —' }),
    contracts.filter((c) => c.status !== 'lost').map((c) => el('option', { value: c.id, text: `${c.title}${c.company ? ` · ${c.company}` : ''}`, selected: c.id === initial.contract_id ? true : null })));
  const link = el('input', { type: 'url', name: 'link', maxlength: 500, placeholder: 'https://zoom.us/j/…  ·  Google Meet  ·  Teams', value: initial.link || '' });
  const notes = el('textarea', { name: 'notes', rows: 3, maxlength: 4000, placeholder: 'Agenda, amount, anything to bring…' });
  if (initial.notes) notes.value = initial.notes;
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });

  add(f, 
    field('Title', titleIn),
    el('div', { class: 'crm-form-row' }, field('Type', kind), field('Date', date)),
    el('label', { class: 'crm-check' }, allDay, el('span', { text: 'All day' })),
    times,
    field('Meeting link', link, 'Zoom, Google Meet, Teams… The client gets a Join button on their page'),
    field('Contract', contract, 'Clients see events on their contract, and get a notification'),
    field('Notes', notes),
    msg,
    isNew ? null : el('div', { class: 'ev-invite' },
      el('span', { text: 'Send it:' }),
      el('a', { class: 'btn btn-ghost btn-sm', href: inviteMailto(initial, contracts), text: 'Email invite' }),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Calendar file (.ics)', onclick: () => downloadIcs(initial, contracts) })),
    el('div', { class: 'crm-form-actions' },
      isNew ? null : armedButton('Delete', 'Click again to delete', async () => {
        const { error } = await supabase.from('events').delete().eq('id', initial.id);
        if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
        m.close(); toast('Event deleted'); onSaved?.();
      }, 'btn btn-ghost danger'),
      el('button', { type: 'submit', class: 'btn btn-primary', text: isNew ? 'Add to calendar' : 'Save' })));

  const m = modal(isNew ? 'New event' : 'Edit event', f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    if (!titleIn.value.trim()) return say('Give it a title.');
    if (!date.value) return say('Pick a date.');
    const at = (t) => new Date(`${date.value}T${t || '00:00'}`).toISOString();
    const row = {
      title: titleIn.value.trim(), kind: kind.value, all_day: allDay.checked,
      starts_at: allDay.checked ? at('09:00') : at(t1.value || '09:00'),
      ends_at: !allDay.checked && t2.value ? at(t2.value) : null,
      contract_id: contract.value || null, notes: notes.value.trim() || null,
      link: link.value.trim() || null,
    };
    if (row.link && !/^https:\/\/\S+$/i.test(row.link)) return say('The meeting link should start with https://');
    if (row.ends_at && row.ends_at < row.starts_at) return say('It ends before it starts.');
    const q = isNew ? supabase.from('events').insert(row) : supabase.from('events').update(row).eq('id', initial.id);
    const { data: saved, error } = await q.select().single();
    if (error) return say(error.message);
    m.close();
    toast(isNew ? 'Added to the calendar' : 'Event saved');
    onSaved?.();
    if (isNew && (saved.link || saved.contract_id)) sendPrompt(saved, contracts);
  });
  return m;
}

/* =====================================================================
   Sending an event: an email with the details and meeting link, and a
   calendar file (.ics) that drops it straight into their calendar.
   ===================================================================== */
function whenText(e) {
  const d = new Date(e.starts_at);
  const day = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (e.all_day) return day;
  const end = e.ends_at ? `–${fmtTime(e.ends_at)}` : '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
  return `${day}, ${fmtTime(e.starts_at)}${end} (${tz})`;
}

function inviteText(e, c, withIcsNote = false) {
  return [
    `Hi${c?.client_name ? ` ${c.client_name.split(' ')[0]}` : ''},`,
    '',
    `You're invited: ${e.title}`,
    `When: ${whenText(e)}`,
    e.link ? `Join (${meetingName(e.link)}): ${e.link}` : null,
    c ? `Project: ${c.title}` : null,
    e.notes ? `\n${e.notes}` : null,
    withIcsNote ? '\nThe calendar file is attached, so you can add it to your calendar in one tap.' : null,
    '',
    'Landon Williams',
    'Williams Systems LLC',
    '(810) 214-5388',
  ].filter((l) => l !== null).join('\n');
}

function inviteMailto(e, contracts) {
  const c = contracts.find((x) => x.id === e.contract_id);
  const subject = `Invitation: ${e.title} · ${new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  return `mailto:${encodeURIComponent(c?.client_email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(inviteText(e, c))}`;
}

const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (t = '') => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function downloadIcs(e, contracts = []) {
  const c = contracts.find((x) => x.id === e.contract_id);
  const start = new Date(e.starts_at);
  const next = new Date(start); next.setDate(next.getDate() + 1);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Williams Systems LLC//Dashboard//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id || crypto.randomUUID()}@williamssystems.dev`,
    `DTSTAMP:${icsDate(new Date())}`,
    e.all_day ? `DTSTART;VALUE=DATE:${ymd(start).replace(/-/g, '')}` : `DTSTART:${icsDate(start)}`,
    e.all_day ? `DTEND;VALUE=DATE:${ymd(next).replace(/-/g, '')}` : `DTEND:${icsDate(e.ends_at || new Date(start.getTime() + 30 * 60000))}`,
    `SUMMARY:${icsEsc(e.title)}`,
    `DESCRIPTION:${icsEsc([e.link ? `Join: ${e.link}` : '', c ? `Project: ${c.title}` : '', e.notes || ''].filter(Boolean).join('\n'))}`,
    e.link ? `LOCATION:${icsEsc(e.link)}` : null,
    e.link ? `URL:${e.link}` : null,
    'ORGANIZER;CN=Landon Williams:mailto:lwilliams@williamssystems.dev',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${e.title.replace(/[^\w -]+/g, '').trim() || 'event'}.ics` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function sendPrompt(e, contracts) {
  const c = contracts.find((x) => x.id === e.contract_id);
  modal('Send the invite?', el('div', { class: 'crm-form' },
    el('p', { text: c?.client_email
      ? `${c.client_name || c.client_email} can already see it on their project page${e.link ? ', with a Join button' : ''}. You can also email it to them.`
      : 'Email the details and meeting link to whoever is joining.' }),
    el('pre', { class: 'ev-preview', text: inviteText(e, c) }),
    el('div', { class: 'crm-form-actions' },
      el('button', { type: 'button', class: 'btn btn-ghost', text: 'Download .ics', onclick: () => downloadIcs(e, contracts) }),
      el('a', { class: 'btn btn-primary', href: inviteMailto(e, contracts), text: 'Open email' }))));
}
