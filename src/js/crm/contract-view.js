/* =====================================================================
   One contract's page: scope of work, deliverables, status, dates,
   timeline, upcoming events, and a live chat between owner and client.

   Owners (owner: true) can edit everything. Clients see the same page
   read-only, except the chat. The database enforces that either way.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import {
  el, $, $$, REDUCED, STATUS, PENDING, statusPill, money, price, fmtDate, fmtTime, timeAgo, dueText,
  toast, armedButton, modal, field, icon, initials, EVENT_KINDS, ymd, fill, add,
} from './util.js';

const SITE = new URL('./', location.href).href;

/**
 * Render a contract into `root`. Returns a cleanup function.
 * opts: { id, owner, me: { id }, onBack?, onChanged?, onDeleted?, addEvent? }
 */
export async function contractPage(root, opts) {
  const { id, owner } = opts;
  root.replaceChildren(el('div', { class: 'cv-loading', text: 'Loading…' }));

  const [c, msgs, evs, acts] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).maybeSingle(),
    supabase.from('contract_messages').select('*').eq('contract_id', id).order('created_at'),
    supabase.from('events').select('*').eq('contract_id', id).order('starts_at'),
    supabase.from('activity').select('*').eq('contract_id', id).order('created_at', { ascending: false }).limit(60),
  ]);
  if (c.error || !c.data) {
    root.replaceChildren(el('div', { class: 'cv-missing' },
      el('h2', { text: 'This contract isn’t available.' }),
      el('p', { text: c.error ? c.error.message : 'It may have been removed.' }),
      opts.onBack ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: opts.onBack, text: '← Back' }) : null));
    return () => {};
  }

  const s = { c: c.data, msgs: msgs.data || [], evs: evs.data || [], acts: acts.data || [] };
  const slots = {
    head: el('div'), stages: el('div'), scope: el('section', { class: 'cv-card' }), items: el('section', { class: 'cv-card' }),
    details: el('section', { class: 'cv-card' }), events: el('section', { class: 'cv-card' }),
    timeline: el('section', { class: 'cv-card' }), chat: el('section', { class: 'cv-card cv-chat' }),
  };

  root.replaceChildren(el('article', { class: `cv${owner ? ' is-owner' : ''}` },
    slots.head, slots.stages,
    el('div', { class: 'cv-grid' },
      el('div', { class: 'cv-main' }, slots.scope, slots.items, slots.timeline),
      el('div', { class: 'cv-side' }, slots.details, slots.chat, slots.events))));

  const save = async (patch, msg) => {
    const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single();
    if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return false; }
    s.c = data;
    renderAll();
    opts.onChanged?.(data);
    if (msg) toast(msg);
    return true;
  };

  /* ---------- header ---------- */
  function renderHead() {
    const c = s.c;
    const who = [c.company, c.client_name].filter(Boolean).join(' · ') || c.client_email || 'No client yet';
    const actions = owner ? el('div', { class: 'cv-actions' },
      el('select', { class: 'status-select', 'aria-label': 'Status', onchange: (e) => save({ status: e.target.value }, `Status set to ${STATUS[e.target.value].label}`) },
        Object.entries(STATUS).map(([k, v]) => el('option', { value: k, selected: k === c.status ? true : null, text: v.label }))),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Edit details', onclick: () => contractForm(c, { onSaved: (d) => { s.c = d; renderAll(); opts.onChanged?.(d); } }) }),
      !c.client_id && c.client_email ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Invite to portal', onclick: () => inviteClient(c.client_email) }) : null,
      armedButton('Delete', 'Click again to delete', async () => {
        const { error } = await supabase.from('contracts').delete().eq('id', id);
        if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
        toast('Contract deleted');
        opts.onDeleted?.();
      }, 'btn btn-ghost btn-sm danger')) : null;

    slots.head.replaceChildren(el('header', { class: 'cv-head' },
      opts.onBack ? el('button', { type: 'button', class: 'cv-back', onclick: opts.onBack, text: '← All contracts' }) : null,
      el('div', { class: 'cv-head-row' },
        el('div', { class: 'cv-title' },
          el('p', { class: 'cv-kicker mono', text: who }),
          el('h1', { text: c.title }),
          el('div', { class: 'cv-meta' }, statusPill(c.status), el('span', { text: price(c) }), el('span', { class: dueClass(c), text: dueText(c) }),
            owner && !c.client_id ? el('span', { class: 'cv-warn', text: c.client_email ? 'Client hasn’t made an account yet' : 'No client email' }) : null)),
        actions)));
  }

  /* ---------- stage tracker ---------- */
  function renderStages() {
    const c = s.c;
    if (c.status === 'lost') {
      slots.stages.replaceChildren(el('div', { class: 'cv-lost', text: `This deal was marked lost ${c.closed_at ? timeAgo(c.closed_at) : ''}.` }));
      return;
    }
    const steps = ['Proposal', 'Signed', 'In progress', 'Complete'];
    const at = PENDING.includes(c.status) ? 0 : c.status === 'complete' ? 3 : c.progress > 0 ? 2 : 1;
    slots.stages.replaceChildren(el('ol', { class: 'cv-stages', 'aria-label': 'Project stage' }, steps.map((t, i) =>
      el('li', { class: i < at ? 'done' : i === at ? 'now' : '', 'aria-current': i === at ? 'step' : null },
        el('i', {}), el('span', { text: i === 0 && at === 0 ? STATUS[c.status].label : i === 2 && c.status === 'on_hold' ? 'On hold' : t })))));
  }

  /* ---------- scope of work ---------- */
  function renderScope(editing = false) {
    const c = s.c;
    const head = el('div', { class: 'cv-card-head' }, el('h2', { text: 'Scope of work' }),
      owner && !editing ? el('button', { type: 'button', class: 'link-btn', text: c.scope ? 'Edit' : 'Write it', onclick: () => renderScope(true) }) : null);
    if (editing) {
      const area = el('textarea', { class: 'cv-textarea', rows: 12, maxlength: 20000, 'aria-label': 'Scope of work', placeholder: 'What’s included, what isn’t, how it’s delivered…' });
      area.value = c.scope || '';
      slots.scope.replaceChildren(head, area, el('div', { class: 'cv-row-end' },
        el('button', { type: 'button', class: 'link-btn', text: 'Cancel', onclick: () => renderScope() }),
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Save', onclick: async () => { await save({ scope: area.value.trim() || null }, 'Scope saved'); } })));
      area.focus();
      return;
    }
    slots.scope.replaceChildren(head, c.scope
      ? el('div', { class: 'cv-scope', text: c.scope })
      : el('p', { class: 'cv-empty', text: owner ? 'No scope written yet. Write what this project covers so the client can see it.' : 'Your scope of work will appear here.' }));
  }

  /* ---------- deliverables ---------- */
  function renderItems() {
    const list = Array.isArray(s.c.deliverables) ? s.c.deliverables : [];
    const done = list.filter((d) => d.done).length;
    const setList = (next, msg) => save({ deliverables: next, ...(next.length ? { progress: s.c.status === 'complete' ? 100 : Math.round((next.filter((d) => d.done).length / next.length) * 100) } : {}) }, msg);
    const input = el('input', { type: 'text', maxlength: 200, placeholder: 'Add a deliverable…', 'aria-label': 'New deliverable' });
    const add = () => { const t = input.value.trim(); if (!t) return; setList([...list, { text: t, done: false }]); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    fill(slots.items, 
      el('div', { class: 'cv-card-head' }, el('h2', { text: 'Deliverables' }), list.length ? el('span', { class: 'cv-count mono', text: `${done}/${list.length} done` }) : null),
      list.length ? el('ul', { class: 'cv-checks' }, list.map((d, i) => el('li', { class: d.done ? 'done' : '' },
        el('label', {},
          el('input', { type: 'checkbox', checked: d.done ? true : null, disabled: owner ? null : true, onchange: (e) => setList(list.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x))) }),
          el('span', { text: d.text })),
        owner ? el('button', { type: 'button', class: 'cv-x', 'aria-label': `Remove ${d.text}`, html: '&times;', onclick: () => setList(list.filter((_, j) => j !== i)) }) : null)))
        : el('p', { class: 'cv-empty', text: owner ? 'Break the work into deliverables. Ticking them off updates progress, and the client is told.' : 'Deliverables will be listed here as the project takes shape.' }),
      owner ? el('div', { class: 'cv-add' }, input, el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Add', onclick: add })) : null);
  }

  /* ---------- details ---------- */
  function renderDetails() {
    const c = s.c;
    const rows = [
      ['Status', statusPill(c.status)],
      ['Price', price(c)],
      ['Billing', c.billing === 'monthly' ? 'Monthly plan' : 'One-time project'],
      ['Start', fmtDate(c.start_date)],
      ['Due', fmtDate(c.due_date)],
      c.client_email && owner ? ['Client', c.client_email] : null,
    ].filter(Boolean);
    const bar = el('div', { class: 'cv-progress' },
      el('div', { class: 'cv-progress-top' }, el('span', { text: 'Progress' }), el('b', { text: `${c.progress}%` })),
      el('div', { class: 'cv-bar' }, el('i', { style: { width: `${c.progress}%` } })));
    if (owner) {
      const range = el('input', { type: 'range', min: 0, max: 100, step: 5, value: c.progress, 'aria-label': 'Progress' });
      range.addEventListener('input', () => { bar.querySelector('b').textContent = `${range.value}%`; bar.querySelector('.cv-bar i').style.width = `${range.value}%`; });
      range.addEventListener('change', () => save({ progress: Number(range.value) }, 'Progress saved'));
      bar.append(range);
    }
    slots.details.replaceChildren(el('div', { class: 'cv-card-head' }, el('h2', { text: 'Details' })),
      el('dl', { class: 'cv-dl' }, rows.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', {}, v)))), bar);
  }

  /* ---------- events ---------- */
  function renderEvents() {
    const now = Date.now() - 86400000;
    const upcoming = s.evs.filter((e) => new Date(e.starts_at).getTime() >= now);
    const past = s.evs.filter((e) => new Date(e.starts_at).getTime() < now).slice(-3).reverse();
    const item = (e) => el('li', { class: `cv-ev k-${e.kind}` },
      el('span', { class: 'cv-ev-date' }, el('b', { text: new Date(e.starts_at).getDate() }), el('small', { text: new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short' }) })),
      el('span', { class: 'cv-ev-body' }, el('strong', { text: e.title }),
        el('small', { text: `${EVENT_KINDS[e.kind] || e.kind}${e.all_day ? '' : ` · ${fmtTime(e.starts_at)}`}` })));
    fill(slots.events, 
      el('div', { class: 'cv-card-head' }, el('h2', { text: 'Schedule' }),
        owner && opts.addEvent ? el('button', { type: 'button', class: 'link-btn', text: '+ Add', onclick: () => opts.addEvent({ contract_id: id, date: ymd(new Date()) }) }) : null),
      upcoming.length ? el('ul', { class: 'cv-evs' }, upcoming.map(item)) : el('p', { class: 'cv-empty', text: 'Nothing scheduled yet.' }),
      past.length ? el('details', { class: 'cv-past' }, el('summary', { text: `Past (${past.length})` }), el('ul', { class: 'cv-evs' }, past.map(item))) : null);
  }

  /* ---------- timeline ---------- */
  function renderTimeline() {
    slots.timeline.replaceChildren(el('div', { class: 'cv-card-head' }, el('h2', { text: 'Timeline' })),
      s.acts.length ? el('ol', { class: 'cv-timeline' }, s.acts.map((a) => el('li', { class: `t-${a.kind}` },
        el('i', {}), el('span', { text: a.summary }), el('time', { class: 'mono', datetime: a.created_at, title: new Date(a.created_at).toLocaleString(), text: timeAgo(a.created_at) }))))
        : el('p', { class: 'cv-empty', text: 'Updates will show up here.' }));
  }

  /* ---------- chat ---------- */
  const chatList = el('ol', { class: 'chat-list', 'aria-live': 'polite' });
  const chatBox = el('textarea', { rows: 1, maxlength: 4000, placeholder: owner ? 'Message the client…' : 'Message Landon…', 'aria-label': 'Message' });
  const sendBtn = el('button', { type: 'submit', class: 'chat-send', 'aria-label': 'Send', html: icon.send });
  const chatForm = el('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); send(); } }, chatBox, sendBtn);
  chatBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  chatBox.addEventListener('input', () => { chatBox.style.height = 'auto'; chatBox.style.height = `${Math.min(chatBox.scrollHeight, 160)}px`; });
  add(slots.chat, 
    el('div', { class: 'cv-card-head' }, el('h2', { text: owner ? `Chat with ${s.c.client_name?.split(' ')[0] || 'client'}` : 'Chat with Landon' }), el('span', { class: 'live on mono' }, el('i'), 'Live')),
    chatList, chatForm,
    owner && !s.c.client_id ? el('p', { class: 'chat-note', text: 'The client will see this chat once they have an account.' }) : null);

  function renderChat(scroll = true) {
    if (!s.msgs.length) {
      chatList.replaceChildren(el('li', { class: 'chat-empty', text: owner ? 'No messages yet. Say hello.' : 'Questions, files to share, feedback — send them here and Landon will reply.' }));
      return;
    }
    let lastDay = '';
    const nodes = [];
    for (const m of s.msgs) {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDay) { nodes.push(el('li', { class: 'chat-day', text: fmtDate(m.created_at, { weekday: 'short', month: 'short', day: 'numeric' }) })); lastDay = d; }
      const mine = m.sender_id === opts.me.id;
      nodes.push(el('li', { class: `chat-msg${mine ? ' mine' : ''}`, 'data-id': m.id },
        mine ? null : el('span', { class: 'chat-av', text: initials(m.sender_name) }),
        el('div', {},
          el('p', { class: 'chat-bubble', text: m.body }),
          el('span', { class: 'chat-meta', text: `${mine ? 'You' : m.sender_name} · ${fmtTime(m.created_at)}` }))));
    }
    chatList.replaceChildren(...nodes);
    if (scroll) chatList.scrollTop = chatList.scrollHeight;
  }

  async function send() {
    const body = chatBox.value.trim();
    if (!body) return;
    sendBtn.disabled = true;
    const { data, error } = await supabase.from('contract_messages').insert({ contract_id: id, body }).select().single();
    sendBtn.disabled = false;
    if (error) return toast(`Couldn’t send: ${error.message}`, 'error');
    chatBox.value = ''; chatBox.style.height = '';
    if (!s.msgs.some((m) => m.id === data.id)) { s.msgs.push(data); renderChat(); }
    chatBox.focus();
  }

  function renderAll() { renderHead(); renderStages(); renderScope(); renderItems(); renderDetails(); renderEvents(); renderTimeline(); }
  renderAll();
  renderChat();
  if (!REDUCED) gsap.from(root.querySelectorAll('.cv-head, .cv-stages, .cv-card'), { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out', clearProps: 'all' });

  // opening the contract reads its notifications
  supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('contract_id', id).is('read_at', null).then(() => opts.onRead?.());

  /* ---------- live updates ---------- */
  const channel = supabase.channel(`contract-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contract_messages', filter: `contract_id=eq.${id}` }, ({ new: m }) => {
      if (s.msgs.some((x) => x.id === m.id)) return;
      s.msgs.push(m);
      renderChat();
      const node = chatList.querySelector(`[data-id="${m.id}"]`);
      if (node && !REDUCED) gsap.from(node, { y: 10, autoAlpha: 0, duration: 0.35, ease: 'power3.out' });
      if (m.sender_id !== opts.me.id) supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('contract_id', id).is('read_at', null).then(() => opts.onRead?.());
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contracts', filter: `id=eq.${id}` }, ({ new: c }) => { s.c = c; renderAll(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `contract_id=eq.${id}` }, ({ new: a }) => {
      if (s.acts.some((x) => x.id === a.id)) return;
      s.acts.unshift(a); renderTimeline();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `contract_id=eq.${id}` }, async () => {
      const { data } = await supabase.from('events').select('*').eq('contract_id', id).order('starts_at');
      s.evs = data || []; renderEvents();
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
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
