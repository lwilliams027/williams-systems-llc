/* =====================================================================
   Tickets — a client's requests (changes, bugs, questions, features),
   with files, an activity thread for back-and-forth, and (owners) one
   click to add a ticket to the contract's scope of work.
   Files live in the private "ticket-files" bucket, one folder per ticket,
   and are opened through short-lived signed links.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import {
  el, REDUCED, toast, modal, field, timeAgo, fmtTime, fmtDate, initials, icon, fill, add,
  richText, formatBytes, money,
} from './util.js';

export const BUCKET = 'ticket-files';
export const T_STATUS = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting on client', resolved: 'Resolved', closed: 'Closed' };
const T_STATUS_CLIENT = { ...T_STATUS, open: 'Sent', waiting: 'Waiting on you' };
export const T_KIND = { change: 'Change request', bug: 'Something’s broken', question: 'Question', feature: 'New feature', other: 'Other' };
export const T_PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
export const OPEN_STATES = ['open', 'in_progress', 'waiting'];
const MAX = 25 * 1024 * 1024;
const statusLabel = (st, owner) => (owner ? T_STATUS : T_STATUS_CLIENT)[st] || st;

/* ---------- small icons ---------- */
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const clip = svg('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');
const KIND_ICON = {
  change: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  bug: svg('<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>'),
  question: svg('<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
  feature: svg('<path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.4 7.2 20 9 13.6 4 10l6.1-1.2z"/>'),
  other: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
};

/** Status as a little ring: empty (new), half (in progress), clock (waiting), check (done). */
export function statusIcon(st) {
  const inner = {
    open: '',
    in_progress: '<path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none"/>',
    waiting: '<path d="M12 8v4l2.5 1.5"/>',
    resolved: '<path d="m8.5 12.5 2.3 2.3 4.7-5.1"/>',
    closed: '<path d="m8.5 12.5 2.3 2.3 4.7-5.1"/>',
  }[st] ?? '';
  return el('span', { class: `tk-st tk-st-${st}`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/>${inner}</svg>` });
}
/** Priority as signal bars (urgent gets an exclamation badge). */
export function priorityIcon(p) {
  if (p === 'urgent') return el('span', { class: 'tk-pr tk-pr-urgent', title: 'Urgent', 'aria-label': 'Urgent priority', text: '!' });
  const n = { low: 1, normal: 2, high: 3 }[p] || 2;
  return el('span', { class: `tk-pr tk-pr-${p}`, title: `${T_PRIORITY[p]} priority`, 'aria-label': `${T_PRIORITY[p]} priority` },
    [1, 2, 3].map((i) => el('i', { class: i <= n ? 'on' : '', style: { height: `${4 + i * 3}px` } })));
}
export const ticketPill = (st, owner = true) => el('span', { class: `tk-chip-st tk-${st}` }, statusIcon(st), statusLabel(st, owner));

/* ---------- files ---------- */
export async function uploadFiles(ticketId, files) {
  const out = [];
  for (const f of files) {
    if (f.size > MAX) { toast(`${f.name} is over 25 MB`, 'error'); continue; }
    const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-100) || 'file';
    const path = `${ticketId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) { toast(`Couldn’t upload ${f.name}: ${error.message}`, 'error'); continue; }
    out.push({ path, name: f.name, size: f.size, type: f.type || '' });
  }
  return out;
}

const extOf = (n = '') => (n.includes('.') ? n.split('.').pop().toLowerCase().slice(0, 4) : 'file');
/** Attached files as cards (image thumbnails when they're pictures). Links are signed once shown. */
export function fileList(files = []) {
  if (!files.length) return null;
  const ul = el('ul', { class: 'tkf-list' }, files.map((f) => el('li', {},
    el('a', { class: 'tkf', target: '_blank', rel: 'noopener', 'aria-disabled': 'true', title: f.name },
      el('span', { class: 'tkf-thumb', text: extOf(f.name) }),
      el('span', { class: 'tkf-info' }, el('span', { class: 'tkf-name', text: f.name }), el('small', { text: formatBytes(f.size) }))))));
  supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 60 * 60).then(({ data }) => {
    (data || []).forEach((d, i) => {
      const a = ul.children[i]?.querySelector('a');
      if (!a || !d.signedUrl) return;
      a.href = d.signedUrl; a.removeAttribute('aria-disabled');
      if ((files[i].type || '').startsWith('image/')) a.querySelector('.tkf-thumb').replaceChildren(el('img', { src: d.signedUrl, alt: '', loading: 'lazy' }));
    });
  });
  return ul;
}

/** Files waiting to be sent: chips you can remove. */
function pickedFiles(onChange) {
  let picked = [];
  const input = el('input', { type: 'file', multiple: true, hidden: true });
  const chips = el('ul', { class: 'tkc-chips' });
  const render = () => { fill(chips, picked.map((f, i) => el('li', {},
    el('span', { class: 'tkc-chip-ext', text: extOf(f.name) }), el('span', { class: 'tkc-chip-name', text: f.name }), el('small', { text: formatBytes(f.size) }),
    el('button', { type: 'button', 'aria-label': `Remove ${f.name}`, html: '&times;', onclick: () => { picked.splice(i, 1); render(); } })))); onChange?.(picked); };
  const addFiles = (list) => { for (const f of list) { if (f.size > MAX) toast(`${f.name} is over 25 MB`, 'error'); else picked.push(f); } render(); };
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  return { input, chips, addFiles, open: () => input.click(), get files() { return picked; }, clear() { picked = []; render(); } };
}

/* =====================================================================
   New ticket / request
   ===================================================================== */
export function ticketForm({ contracts = [], contractId = null, owner = false, onCreated } = {}) {
  const f = el('form', { class: 'crm-form tkn', novalidate: true });
  const usable = contracts.filter((c) => c.status !== 'lost');
  const contractSel = el('select', { name: 'contract_id' },
    owner || !usable.length ? el('option', { value: '', text: owner ? '— Choose a project —' : 'General (no project yet)' }) : null,
    usable.map((c) => el('option', { value: c.id, text: c.title, selected: c.id === contractId ? true : null })));
  const title = el('input', { name: 'title', class: 'tkn-title', maxlength: 160, required: true, placeholder: owner ? 'What needs doing?' : 'What do you need? e.g. “Add a gallery page”' });
  let kind = 'change', prio = 'normal';
  const kinds = el('div', { class: 'tkn-kinds', role: 'radiogroup', 'aria-label': 'Type' });
  const drawKinds = () => fill(kinds, Object.entries(T_KIND).map(([k, v]) => el('button', { type: 'button', role: 'radio', class: 'tkn-kind', 'aria-checked': String(kind === k), onclick: () => { kind = k; drawKinds(); } },
    el('span', { class: `tkn-kind-ico k-${k}`, html: KIND_ICON[k] }), el('span', { text: v }))));
  drawKinds();
  const prios = el('div', { class: 'tkn-prio', role: 'radiogroup', 'aria-label': 'Priority' });
  const drawPrio = () => fill(prios, Object.entries(T_PRIORITY).map(([k, v]) => el('button', { type: 'button', role: 'radio', class: 'tkn-prio-btn', 'aria-checked': String(prio === k), onclick: () => { prio = k; drawPrio(); } },
    priorityIcon(k), el('span', { text: v }))));
  drawPrio();
  const body = el('textarea', { name: 'body', rows: 5, maxlength: 8000, placeholder: 'Add the details: what, where, and any links or examples. Screenshots help a lot.' });
  const pf = pickedFiles();
  const drop = el('div', { class: 'tkn-drop', role: 'button', tabindex: 0 },
    el('span', { class: 'tkn-drop-ico', html: clip }),
    el('span', {}, el('strong', { text: 'Attach files' }), el('small', { text: 'Drop them here or click to browse · up to 25 MB each' })),
    pf.input);
  drop.addEventListener('click', (e) => { if (e.target !== pf.input) pf.open(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pf.open(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); pf.addFiles(e.dataTransfer.files); });
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
  add(f,
    usable.length > 1 || owner ? field('Project', contractSel) : null,
    title,
    el('div', { class: 'tkn-block' }, el('span', { class: 'tkn-label', text: 'Type' }), kinds),
    el('div', { class: 'tkn-block' }, el('span', { class: 'tkn-label', text: 'Priority' }), prios),
    body,
    drop, pf.chips, msg,
    el('div', { class: 'crm-form-actions tkn-foot' },
      el('small', { class: 'tkn-hint', text: owner ? 'The client is notified.' : 'Landon is notified and replies in the ticket.' }),
      el('button', { type: 'submit', class: 'btn btn-primary', text: owner ? 'Create ticket' : 'Send request' })));
  const m = modal(owner ? 'New ticket' : 'New request', f, { wide: true });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    if (!title.value.trim()) { title.focus(); return say('Give it a short title.'); }
    const cid = (usable.length > 1 || owner) ? contractSel.value || null : usable[0]?.id || null;
    if (owner && !cid) return say('Choose which project this is for.');
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = pf.files.length ? 'Uploading…' : 'Sending…';
    const row = { contract_id: cid, title: title.value.trim(), body: body.value.trim() || null, kind, priority: prio };
    if (owner) row.client_id = null;   // filled in from the contract by the database
    const { data: t, error } = await supabase.from('tickets').insert(row).select().single();
    if (error) { btn.disabled = false; btn.textContent = 'Try again'; return say(error.message); }
    let ticket = t;
    if (pf.files.length) {
      const files = await uploadFiles(t.id, pf.files);
      if (files.length) {
        const res = await supabase.from('tickets').update({ files }).eq('id', t.id).select().single();
        if (!res.error) ticket = res.data;
      }
    }
    m.close();
    toast(owner ? `Ticket #${ticket.number} created` : 'Request sent. Landon will reply in the ticket.');
    onCreated?.(ticket);
  });
  setTimeout(() => title.focus(), 30);
  return m;
}

/* =====================================================================
   One ticket: the request, an activity thread, a composer, and a
   properties panel (status, priority, type, scope…)
   opts: { id, owner, me, contracts, onBack?, onChanged?, onDeleted?, onRead? }
   ===================================================================== */
export async function ticketView(root, opts) {
  const { id, owner } = opts;
  fill(root, el('div', { class: 'cv-loading', text: 'Loading…' }));
  const [t, msgs] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'),
  ]);
  if (t.error || !t.data) {
    fill(root, el('div', { class: 'cv-missing' }, el('h2', { text: 'This ticket isn’t available.' }),
      opts.onBack ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '← Back', onclick: opts.onBack }) : null));
    return () => {};
  }
  const s = { t: t.data, msgs: msgs.data || [] };
  const contractOf = () => (opts.contracts || []).find((c) => c.id === s.t.contract_id);
  const clientName = () => contractOf()?.client_name || 'Client';

  const head = el('header', { class: 'tkv-head' });
  const desc = el('section', { class: 'tkv-desc' });
  const thread = el('ol', { class: 'tkv-thread', 'aria-live': 'polite' });
  const props = el('aside', { class: 'tkv-props', 'aria-label': 'Ticket details' });

  // composer: one box with attach, chips and send inside
  const box = el('textarea', { rows: 1, maxlength: 4000, placeholder: owner ? `Reply to ${clientName().split(' ')[0]}…` : 'Write a reply…', 'aria-label': 'Reply' });
  const send = el('button', { type: 'submit', class: 'tkc-send', 'aria-label': 'Send', html: icon.send });
  const pf = pickedFiles(() => sync());
  const sync = () => { send.disabled = !box.value.trim() && !pf.files.length; };
  const composer = el('form', { class: 'tkc', onsubmit: (e) => { e.preventDefault(); reply(); } },
    box, pf.chips,
    el('div', { class: 'tkc-bar' },
      el('button', { type: 'button', class: 'tkc-attach', 'aria-label': 'Attach files', title: 'Attach files', html: clip, onclick: () => pf.open() }), pf.input,
      el('small', { class: 'tkc-hint', text: 'Enter to send · Shift+Enter for a new line' }),
      send));
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 200)}px`; sync(); });
  composer.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); composer.classList.add('over'); } });
  composer.addEventListener('dragleave', () => composer.classList.remove('over'));
  composer.addEventListener('drop', (e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); composer.classList.remove('over'); pf.addFiles(e.dataTransfer.files); });
  sync();

  fill(root, el('article', { class: 'tkv' },
    head,
    el('div', { class: 'tkv-grid' },
      el('div', { class: 'tkv-main' }, desc,
        el('section', { class: 'tkv-activity' }, el('h3', { class: 'tkv-h', text: 'Activity' }), thread, composer)),
      props)));

  async function save(patch, say) {
    const { data, error } = await supabase.from('tickets').update(patch).eq('id', id).select().single();
    if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return null; }
    s.t = data; renderHead(); renderProps(); opts.onChanged?.(data);
    if (say) toast(say);
    return data;
  }

  function renderHead() {
    const tk = s.t;
    fill(head,
      opts.onBack ? el('button', { type: 'button', class: 'tkv-back', onclick: opts.onBack, html: `${svg('<path d="m15 18-6-6 6-6"/>')}<span>All tickets</span>` }) : null,
      el('div', { class: 'tkv-kicker' }, statusIcon(tk.status), el('span', { class: 'mono', text: `#${tk.number}` }), el('span', { class: 'tkv-dot', text: '·' }),
        el('span', { class: `tkv-kind k-${tk.kind}`, html: KIND_ICON[tk.kind] }), el('span', { text: T_KIND[tk.kind] })),
      el('h2', { class: 'tkv-title', text: tk.title }),
      el('p', { class: 'tkv-sub', text: `${tk.created_by === opts.me.id ? 'You' : owner ? clientName() : 'Landon'} opened this ${timeAgo(tk.created_at)} · updated ${timeAgo(tk.updated_at)}` }));
  }

  function renderDesc() {
    const tk = s.t;
    fill(desc,
      tk.body ? richText(tk.body, 'div', { class: 'tkv-body' }) : el('p', { class: 'tkv-empty', text: 'No details were added.' }),
      tk.files?.length ? el('div', { class: 'tkv-files' }, el('h3', { class: 'tkv-h', text: `Attachments · ${tk.files.length}` }), fileList(tk.files)) : null);
  }

  const propRow = (label, value) => el('div', { class: 'tkp' }, el('dt', { text: label }), el('dd', {}, value));
  const select = (value, options, onchange, label) => {
    const sel = el('select', { class: 'tkp-select', 'aria-label': label }, options.map(([k, v]) => el('option', { value: k, text: v, selected: k === value ? true : null })));
    sel.addEventListener('change', () => onchange(sel.value));
    return sel;
  };
  function renderProps() {
    const tk = s.t, c = contractOf();
    const status = owner
      ? el('span', { class: 'tkp-with-ico' }, statusIcon(tk.status), select(tk.status, Object.entries(T_STATUS), (v) => save({ status: v }, `Marked ${T_STATUS[v].toLowerCase()}`), 'Status'))
      : el('span', { class: 'tkp-with-ico' }, statusIcon(tk.status), statusLabel(tk.status, false));
    const priority = owner
      ? el('span', { class: 'tkp-with-ico' }, priorityIcon(tk.priority), select(tk.priority, Object.entries(T_PRIORITY), (v) => save({ priority: v }, `Priority set to ${T_PRIORITY[v].toLowerCase()}`), 'Priority'))
      : el('span', { class: 'tkp-with-ico' }, priorityIcon(tk.priority), T_PRIORITY[tk.priority]);
    const kind = owner
      ? el('span', { class: 'tkp-with-ico' }, el('span', { class: `tkv-kind k-${tk.kind}`, html: KIND_ICON[tk.kind] }), select(tk.kind, Object.entries(T_KIND), (v) => save({ kind: v }, 'Type updated'), 'Type'))
      : el('span', { class: 'tkp-with-ico' }, el('span', { class: `tkv-kind k-${tk.kind}`, html: KIND_ICON[tk.kind] }), T_KIND[tk.kind]);
    const scope = tk.sow_added_at
      ? el('span', { class: 'tkp-scope ok', text: `✓ In scope since ${fmtDate(tk.sow_added_at, { month: 'short', day: 'numeric' })}` })
      : owner ? el('button', { type: 'button', class: 'btn btn-primary btn-sm tkp-sow', text: 'Add to scope of work',
        onclick: () => addToSow(s.t, { contracts: opts.contracts || [], onDone: (tk2) => { s.t = tk2; renderHead(); renderProps(); opts.onChanged?.(tk2); } }) })
        : el('span', { class: 'tkp-muted', text: 'Not yet' });
    fill(props,
      el('dl', { class: 'tkp-list' },
        propRow('Status', status),
        propRow('Priority', priority),
        propRow('Type', kind),
        propRow('Scope of work', scope),
        c && owner ? propRow('Project', el('a', { class: 'tkp-link', href: `#contract/${c.id}`, text: c.title })) : null,
        propRow('Opened', fmtDate(tk.created_at, { month: 'short', day: 'numeric', year: 'numeric' })),
        tk.resolved_at ? propRow('Resolved', fmtDate(tk.resolved_at, { month: 'short', day: 'numeric', year: 'numeric' })) : null),
      owner && OPEN_STATES.includes(tk.status) ? el('div', { class: 'tkp-quick' },
        tk.status !== 'waiting' ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Ask the client', title: 'Mark as waiting on the client', onclick: () => save({ status: 'waiting' }, 'Marked waiting on the client') }) : null,
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Resolve', onclick: () => save({ status: 'resolved' }, 'Resolved') })) : null,
      owner && !OPEN_STATES.includes(tk.status) ? el('div', { class: 'tkp-quick' },
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Reopen', onclick: () => save({ status: 'open' }, 'Reopened') })) : null,
      owner ? deleteBtn() : null);
  }

  function deleteBtn() {
    let timer;
    const btn = el('button', { type: 'button', class: 'link-btn danger tkp-delete', text: 'Delete ticket' });
    btn.addEventListener('click', async () => {
      if (!btn.dataset.armed) { btn.dataset.armed = 'true'; btn.textContent = 'Click again to delete'; timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Delete ticket'; }, 4000); return; }
      clearTimeout(timer);
      const paths = [...(s.t.files || []), ...s.msgs.flatMap((m) => m.files || [])].map((f) => f.path);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
      toast('Ticket deleted'); opts.onDeleted?.();
    });
    return btn;
  }

  const SYS_ICON = svg('<circle cx="12" cy="12" r="3"/>');
  function renderThread(scroll = false) {
    const items = [];
    for (const m of s.msgs) {
      if (m.kind === 'system') {
        items.push(el('li', { class: 'tka-sys', 'data-id': m.id },
          el('span', { class: 'tka-sys-ico', html: /scope/i.test(m.body) ? svg('<path d="m5 12 5 5 9-10"/>') : SYS_ICON }),
          el('span', { class: 'tka-sys-text', text: m.body.replace(/^Status: /, 'Status changed: ') }),
          el('time', { text: timeAgo(m.created_at), title: new Date(m.created_at).toLocaleString() })));
        continue;
      }
      const mine = m.sender_id === opts.me.id;
      const name = mine ? 'You' : m.sender_role === 'owner' && !owner ? 'Landon Williams' : m.sender_name;
      items.push(el('li', { class: `tka-msg${m.sender_role === 'owner' ? ' from-owner' : ''}`, 'data-id': m.id },
        el('span', { class: 'tka-av', text: initials(mine ? m.sender_name : name) }),
        el('div', { class: 'tka-card' },
          el('div', { class: 'tka-meta' }, el('strong', { text: name }), el('time', { text: timeAgo(m.created_at), title: new Date(m.created_at).toLocaleString() })),
          m.body ? richText(m.body, 'div', { class: 'tka-body' }) : null,
          fileList(m.files))));
    }
    fill(thread, items.length ? items : el('li', { class: 'tka-empty', text: owner ? 'No replies yet. Your reply goes straight to the client.' : 'Landon will reply here. Add more details or files any time.' }));
    if (scroll) composer.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }

  async function reply() {
    const body = box.value.trim();
    if (!body && !pf.files.length) return;
    send.disabled = true;
    const files = pf.files.length ? await uploadFiles(id, pf.files) : [];
    if (!body && !files.length) { sync(); return; }
    const { data, error } = await supabase.from('ticket_messages').insert({ ticket_id: id, body, files }).select().single();
    if (error) { sync(); return toast(`Couldn’t send: ${error.message}`, 'error'); }
    box.value = ''; box.style.height = ''; pf.clear(); sync();
    if (!s.msgs.some((m) => m.id === data.id)) { s.msgs.push(data); renderThread(true); }
    box.focus();
  }

  renderHead(); renderDesc(); renderProps(); renderThread();
  supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('ticket_id', id).is('read_at', null).then(() => opts.onRead?.());

  const channel = supabase.channel(`ticket-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` }, ({ new: m }) => {
      if (s.msgs.some((x) => x.id === m.id)) return;
      s.msgs.push(m); renderThread();
      const node = thread.querySelector(`[data-id="${m.id}"]`);
      if (node && !REDUCED) gsap.from(node, { y: 8, autoAlpha: 0, duration: 0.3, ease: 'power2.out' });
      if (m.sender_id !== opts.me.id) supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('ticket_id', id).is('read_at', null).then(() => opts.onRead?.());
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, ({ new: tk }) => { s.t = tk; renderHead(); renderDesc(); renderProps(); })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* =====================================================================
   Add a ticket to a contract's scope of work (owners)
   ===================================================================== */
export function addToSow(ticket, { contracts = [], onDone } = {}) {
  const usable = contracts.filter((c) => c.status !== 'lost');
  const f = el('form', { class: 'crm-form', novalidate: true });
  const contractSel = el('select', { name: 'contract' },
    el('option', { value: '', text: '— Choose a project —' }),
    usable.map((c) => el('option', { value: c.id, text: `${c.title}${c.company ? ` · ${c.company}` : ''}`, selected: c.id === ticket.contract_id ? true : null })));
  const item = el('input', { name: 'item', maxlength: 200, value: ticket.title });
  const addScope = el('input', { type: 'checkbox', checked: true });
  const details = el('textarea', { rows: 4, maxlength: 4000 });
  details.value = ticket.body || '';
  const delta = el('input', { type: 'number', step: 50, placeholder: '0', inputmode: 'decimal' });
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
  add(f,
    el('p', { text: 'Adds this request to the project as a deliverable, and (if you like) writes it into the scope of work. The client sees it on their page and is told.' }),
    usable.length > 1 || !ticket.contract_id ? field('Project', contractSel) : null,
    field('Deliverable', item),
    el('label', { class: 'crm-check' }, addScope, el('span', { text: 'Also add the details to the scope of work' })),
    field('Details for the scope', details),
    field('Price change (USD)', delta, 'Optional. Added to the price, e.g. 250. Use a minus to lower it.'),
    msg,
    el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: 'Add to scope of work' })));
  addScope.addEventListener('change', () => { details.closest('.crm-field').hidden = !addScope.checked; });
  const m = modal(`Add #${ticket.number} to the scope of work`, f, { wide: true });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    const cid = contractSel.value || ticket.contract_id;
    if (!cid) return say('Choose the project it belongs to.');
    if (!item.value.trim()) return say('Name the deliverable.');
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const { data: c, error: e1 } = await supabase.from('contracts').select('*').eq('id', cid).single();
    if (e1) { btn.disabled = false; return say(e1.message); }
    const deliverables = [...(c.deliverables || []), { text: item.value.trim(), done: false, ticket: ticket.number }];
    const patch = {
      deliverables,
      progress: c.status === 'complete' ? 100 : Math.round((deliverables.filter((d) => d.done).length / deliverables.length) * 100),
    };
    if (addScope.checked) {
      const when = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const extra = `Added from ticket #${ticket.number} (${when}): ${item.value.trim()}${details.value.trim() ? `\n${details.value.trim()}` : ''}`;
      patch.scope = c.scope ? `${c.scope}\n\n${extra}` : extra;
    }
    const d = Number(delta.value);
    if (d) patch.value = Math.max(0, Number(c.value) + d);
    const { error: e2 } = await supabase.from('contracts').update(patch).eq('id', c.id);
    if (e2) { btn.disabled = false; return say(e2.message); }
    const { data: tk, error: e3 } = await supabase.from('tickets').update({
      sow_added_at: new Date().toISOString(), contract_id: c.id, ...(ticket.status === 'open' ? { status: 'in_progress' } : {}),
    }).eq('id', ticket.id).select().single();
    if (e3) { btn.disabled = false; return say(e3.message); }
    m.close();
    toast(`Added to ${c.title}${d ? ` · price ${d > 0 ? '+' : ''}${money(d)}` : ''}`);
    onDone?.(tk);
  });
  return m;
}

/* =====================================================================
   The list of tickets (project Tickets tab)
   ===================================================================== */
export function ticketRows(tickets, { owner, onOpen, selectedId = null }) {
  return el('ul', { class: 'tkl' }, tickets.map((t) => el('li', {},
    el('button', { type: 'button', class: `tkl-row${t.id === selectedId ? ' on' : ''}${t.status === 'open' && owner ? ' unread' : ''}`, onclick: () => onOpen(t) },
      statusIcon(t.status),
      el('span', { class: 'tkl-main' },
        el('strong', { text: t.title }),
        el('small', {}, el('span', { class: 'mono', text: `#${t.number}` }), ` · ${T_KIND[t.kind]} · ${timeAgo(t.updated_at)}`)),
      el('span', { class: 'tkl-side' },
        t.files?.length ? el('span', { class: 'tkl-clip', title: `${t.files.length} attachment${t.files.length === 1 ? '' : 's'}` }, el('span', { html: clip }), String(t.files.length)) : null,
        priorityIcon(t.priority))))));
}
